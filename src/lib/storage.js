import { openDB } from 'idb'
import { nowIso } from './util.js'

export const SCHEMA_VERSION = 1
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
  meta: 'key'
}

const STORE_NAMES = Object.keys(STORES)
const LEGACY_PROJECTS = 'sciveyra-projects'
const LEGACY_REFERENCES = 'sciveyra-references'

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
  if (hasIDB()) {
    const db = await getDB()
    await db.put(store, record)
  } else {
    memory[store].set(record[keyPath], record)
  }
  return record
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
  for (const store of STORE_NAMES) data[store] = await dbGetAll(store)
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
  for (const store of STORE_NAMES) {
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
    for (const record of clean) await dbPut(store, record)
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
