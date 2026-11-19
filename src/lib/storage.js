import { openDB } from 'idb'
import { nowIso } from './util.js'

export const SCHEMA_VERSION = 2
export const DB_NAME = 'sciveyra'
export const STORES = {
  datasets: 'id',
  graphs: 'id',
  figures: 'id',
  diagrams: 'id',
  drafts: 'id',
  references: 'id',
  assets: 'id',
  projects: 'id',
  settings: 'key',
  meta: 'key',
  versions: 'id',
  searchCache: 'id'
}

const STORE_NAMES = Object.keys(STORES)
/** Derived data that can always be rebuilt; never stored in backups. */
export const VOLATILE_STORES = ['searchCache']
const HISTORY_STORES = [
  'datasets', 'graphs', 'figures', 'diagrams', 'drafts', 'references', 'assets', 'projects'
]
export const BACKUP_STORES = STORE_NAMES.filter((name) => !VOLATILE_STORES.includes(name))
const MAX_VERSIONS_PER_RECORD = 12
const MAX_VERSIONS_TOTAL = 150
const MAX_SNAPSHOT_BYTES = 250_000
const LEGACY_PROJECTS = 'sciveyra-projects'
const LEGACY_REFERENCES = 'sciveyra-references'
let versionSequence = 0

function compareVersionsDescending(a, b) {
  return (Number(b.sequence) || 0) - (Number(a.sequence) || 0)
    || String(b.createdAt).localeCompare(String(a.createdAt))
    || String(b.id).localeCompare(String(a.id))
}

let dbPromise = null
const memory = Object.fromEntries(STORE_NAMES.map((name) => [name, new Map()]))
let useMemory = typeof indexedDB === 'undefined'

function hasIDB() {
  return !useMemory && typeof indexedDB !== 'undefined'
}

export async function getDB() {
  if (!hasIDB()) return null
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, SCHEMA_VERSION, {
      upgrade(db) {
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath })
        }
      }
    })
  }
  return dbPromise
}

export async function dbPut(store, value) {
  validateStore(store)
  if (!value || typeof value !== 'object') throw new Error('A record object is required.')
  const keyPath = STORES[store]
  if (!value[keyPath]) value[keyPath] = store === 'settings' || store === 'meta'
    ? String(Date.now())
    : `id_${Math.random().toString(36).slice(2)}`
  const record = { ...value, updatedAt: value.updatedAt || nowIso() }
  if (record.createdAt === undefined) record.createdAt = record.updatedAt
  await maybeSnapshot(store, keyPath, record)
  await writeRecord(store, record)
  return record
}

async function writeRecord(store, record) {
  if (hasIDB()) {
    const db = await getDB()
    await db.put(store, record)
  } else {
    memory[store].set(record[STORES[store]], record)
  }
}

function cloneRecord(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function fingerprint(value) {
  if (!value || typeof value !== 'object') return ''
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...content } = value
  return JSON.stringify(content)
}

/** Store a bounded "before" image so any saved record can be restored later. */
async function maybeSnapshot(store, keyPath, nextRecord, { deleted = false } = {}) {
  if (!HISTORY_STORES.includes(store)) return
  const previous = await dbGet(store, nextRecord[keyPath])
  if (!previous) return
  if (!deleted && fingerprint(previous) === fingerprint(nextRecord)) return
  const snapshotTime = nowIso()
  const snapshotRecord = {
    id: `ver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    sequence: ++versionSequence,
    createdAt: snapshotTime,
    updatedAt: snapshotTime,
    store,
    recordId: String(nextRecord[keyPath]),
    record: cloneRecord(previous),
    deleted,
    reason: deleted ? 'Deleted' : 'Edited'
  }
  if (JSON.stringify(snapshotRecord).length > MAX_SNAPSHOT_BYTES) return
  await writeRecord('versions', snapshotRecord)
  await pruneVersions(snapshotRecord.store, snapshotRecord.recordId)
}

async function pruneVersions(store, recordId) {
  const versions = await dbGetAll('versions')
  const forRecord = versions
    .filter((version) => version.store === store && version.recordId === recordId)
    .sort(compareVersionsDescending)
  for (const stale of forRecord.slice(MAX_VERSIONS_PER_RECORD)) await dbDelete('versions', stale.id)
  if (versions.length <= MAX_VERSIONS_TOTAL) return
  const oldest = versions
    .slice()
    .sort((a, b) => -compareVersionsDescending(a, b))
  for (const stale of oldest.slice(0, versions.length - MAX_VERSIONS_TOTAL)) {
    await dbDelete('versions', stale.id)
  }
}

export async function dbGetAll(store) {
  validateStore(store)
  if (!hasIDB()) return [...memory[store].values()]
  const db = await getDB()
  return db.getAll(store)
}

export async function dbGet(store, key) {
  validateStore(store)
  if (!hasIDB()) return memory[store].get(key) || null
  const db = await getDB()
  return (await db.get(store, key)) || null
}

export async function dbDelete(store, key) {
  validateStore(store)
  if (HISTORY_STORES.includes(store)) {
    const previous = await dbGet(store, key)
    if (previous) await maybeSnapshot(store, STORES[store], previous, { deleted: true })
  }
  if (!hasIDB()) { memory[store].delete(key); return }
  const db = await getDB()
  await db.delete(store, key)
}

export async function dbClear(store) {
  validateStore(store)
  if (!hasIDB()) { memory[store].clear(); return }
  const db = await getDB()
  await db.clear(store)
}

/** Saved "before" images, newest first. Filters are optional. */
export async function listVersions({ store, recordId, limit } = {}) {
  let versions = await dbGetAll('versions')
  if (store) versions = versions.filter((version) => version.store === store)
  if (recordId) versions = versions.filter((version) => version.recordId === String(recordId))
  versions.sort(compareVersionsDescending)
  return Number.isFinite(limit) ? versions.slice(0, Math.max(0, limit)) : versions
}

export async function getVersion(id) {
  return dbGet('versions', id)
}

/** Restore a snapshot into its original collection. The current state is snapshotted first. */
export async function restoreVersion(id) {
  const version = await getVersion(id)
  if (!version) throw new Error('That version is no longer available.')
  if (!HISTORY_STORES.includes(version.store)) throw new Error('This version cannot be restored automatically.')
  const keyPath = STORES[version.store]
  const record = cloneRecord(version.record)
  if (!record || typeof record !== 'object' || !record[keyPath]) throw new Error('The saved version is incomplete.')
  return dbPut(version.store, record)
}

export async function deleteVersion(id) {
  await dbDelete('versions', id)
}

export async function clearHistory() {
  await dbClear('versions')
}

/**
 * @template T
 * @param {string} key
 * @param {T} [fallback]
 * @returns {Promise<T>}
 */
export async function getSetting(key, fallback = null) {
  const record = await dbGet('settings', key)
  return record ? record.value : fallback
}

export async function setSetting(key, value) {
  return dbPut('settings', { key, value })
}

function validateStore(store) {
  if (!Object.prototype.hasOwnProperty.call(STORES, store)) {
    throw new Error(`Unknown storage collection: ${store}`)
  }
}

export async function exportBackup() {
  const data = {}
  for (const store of BACKUP_STORES) data[store] = await dbGetAll(store)
  return {
    app: 'SciVeyra',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    data
  }
}

export async function importBackup(payload, { mode = 'replace' } = {}) {
  if (!payload || typeof payload !== 'object') throw new Error('Backup is not a JSON object.')
  if (payload.app && payload.app !== 'SciVeyra') throw new Error('This file is not a SciVeyra backup.')
  const version = Number(payload.schemaVersion)
  if (!Number.isInteger(version) || version < 1) throw new Error('Backup schema version is missing or invalid.')
  if (version > SCHEMA_VERSION) {
    throw new Error(`Backup schema v${version} is newer than this app (v${SCHEMA_VERSION}). Please update SciVeyra.`)
  }
  const data = payload.data
  if (!data || typeof data !== 'object') throw new Error('Backup does not contain a data object.')

  const counts = {}
  for (const store of BACKUP_STORES) {
    const records = data[store]
    if (records === undefined) continue
    if (!Array.isArray(records)) throw new Error(`Backup field "${store}" must be a list.`)
    if (records.length > 200000) throw new Error(`Backup field "${store}" is too large.`)
    const keyPath = STORES[store]
    const clean = records.map((record, index) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error(`Backup ${store} record ${index + 1} is invalid.`)
      }
      if (!record[keyPath]) throw new Error(`Backup ${store} record ${index + 1} is missing "${keyPath}".`)
      return JSON.parse(JSON.stringify(record))
    })
    if (mode === 'replace') await dbClear(store)
    for (const record of clean) {
      await dbPut(store, record)
      if (store === 'versions' && Number(record.sequence) > versionSequence) versionSequence = Number(record.sequence)
    }
    counts[store] = clean.length
  }
  await setSetting('schemaVersion', SCHEMA_VERSION)
  return counts
}

export async function clearAllData() {
  for (const store of STORE_NAMES) {
    if (store === 'meta' || store === 'settings') continue
    await dbClear(store)
  }
}

export async function migrateLegacyData() {
  if (typeof localStorage === 'undefined') return { migrated: false }
  const already = await getSetting('legacyMigrationDone', false)
  if (already) return { migrated: false }
  let projects = []
  let references = []
  try {
    projects = JSON.parse(localStorage.getItem(LEGACY_PROJECTS) || '[]')
    references = JSON.parse(localStorage.getItem(LEGACY_REFERENCES) || '[]')
  } catch {
    projects = []
    references = []
  }
  let migrated = 0
  if (Array.isArray(projects)) {
    for (const project of projects) {
      if (!project || !project.id) continue
      await dbPut('projects', {
        id: project.id,
        name: project.name || 'Untitled project',
        type: project.type || 'Research project',
        kind: project.kind || 'chart',
        source: 'legacy',
        updatedAt: nowIso()
      })
      migrated++
    }
  }
  if (Array.isArray(references)) {
    for (const reference of references) {
      if (!reference || !reference.id) continue
      await dbPut('references', normalizeLegacyReference(reference))
      migrated++
    }
  }
  await setSetting('legacyMigrationDone', true)
  await setSetting('schemaVersion', SCHEMA_VERSION)
  return { migrated: migrated > 0, count: migrated }
}

function normalizeLegacyReference(reference) {
  return {
    id: reference.id,
    type: 'article',
    title: reference.title || 'Untitled reference',
    authors: reference.authors ? String(reference.authors).split(/,\s*/).filter(Boolean) : [],
    year: reference.year || '',
    journal: reference.journal || '',
    doi: reference.doi || '',
    url: reference.url || '',
    notes: '',
    source: 'legacy'
  }
}

export async function storageEstimate() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  try {
    const estimate = await navigator.storage.estimate()
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0
    }
  } catch {
    return null
  }
}
