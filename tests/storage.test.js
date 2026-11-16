import { beforeEach, describe, expect, it } from 'vitest'
import {
  SCHEMA_VERSION, STORES, clearAllData, dbClear, dbDelete, dbGet, dbGetAll,
  dbPut, exportBackup, getSetting, importBackup, setSetting
} from '../src/lib/storage.js'

const stores = Object.keys(STORES)

beforeEach(async () => {
  for (const store of stores) await dbClear(store)
})

describe('local storage layer', () => {
  it('creates, reads, updates and deletes records', async () => {
    const record = await dbPut('references', { title: 'Test reference' })
    expect(record.id).toMatch(/^id_/)
    expect(record.createdAt).toBeTruthy()
    expect((await dbGet('references', record.id)).title).toBe('Test reference')

    const updated = await dbPut('references', { ...record, title: 'Updated' })
    expect(updated.id).toBe(record.id)
    expect(await dbGetAll('references')).toHaveLength(1)

    await dbDelete('references', record.id)
    expect(await dbGet('references', record.id)).toBeNull()
  })

  it('rejects unknown collections and invalid records', async () => {
    await expect(dbPut('not-a-store', {})).rejects.toThrow(/Unknown storage/)
    await expect(dbPut('references', null)).rejects.toThrow(/record object/)
  })

  it('stores and reads typed settings', async () => {
    await setSetting('theme', 'dark')
    expect(await getSetting('theme', 'light')).toBe('dark')
    expect(await getSetting('missing', 42)).toBe(42)
  })
})

describe('backup and restore', () => {
  it('exports every collection with a schema version', async () => {
    await dbPut('datasets', { id: 'ds_1', name: 'Dataset' })
    await dbPut('references', { id: 'ref_1', title: 'Paper' })
    const backup = await exportBackup()
    expect(backup.app).toBe('SciVeyra')
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION)
    expect(Object.keys(backup.data)).toEqual(stores)
    expect(backup.data.datasets).toHaveLength(1)
    expect(backup.data.references).toHaveLength(1)
  })

  it('replaces existing data when restoring in replace mode', async () => {
    await dbPut('datasets', { id: 'old', name: 'Old' })
    const result = await importBackup({
      app: 'SciVeyra',
      schemaVersion: SCHEMA_VERSION,
      data: { datasets: [{ id: 'new', name: 'New' }], references: [{ id: 'r1', title: 'One' }] }
    }, { mode: 'replace' })
    expect(result.datasets).toBe(1)
    expect(result.references).toBe(1)
    const datasets = await dbGetAll('datasets')
    expect(datasets.map((dataset) => dataset.id)).toEqual(['new'])
    expect(await getSetting('schemaVersion')).toBe(SCHEMA_VERSION)
  })

  it('rejects malformed, newer or foreign backups', async () => {
    await expect(importBackup(null)).rejects.toThrow(/JSON object/)
    await expect(importBackup({ app: 'Other', schemaVersion: 1, data: {} })).rejects.toThrow(/not a SciVeyra/)
    await expect(importBackup({ app: 'SciVeyra', schemaVersion: 'x', data: {} })).rejects.toThrow(/schema version/)
    await expect(importBackup({ app: 'SciVeyra', schemaVersion: 99, data: {} })).rejects.toThrow(/newer/)
    await expect(importBackup({ app: 'SciVeyra', schemaVersion: 1 })).rejects.toThrow(/data object/)
    await expect(importBackup({ app: 'SciVeyra', schemaVersion: 1, data: { datasets: 'bad' } })).rejects.toThrow(/must be a list/)
    await expect(importBackup({ app: 'SciVeyra', schemaVersion: 1, data: { datasets: [{ name: 'Missing id' }] } })).rejects.toThrow(/missing "id"/)
  })
})

describe('clearing data', () => {
  it('clears research collections but keeps settings', async () => {
    await dbPut('datasets', { id: 'ds_1', name: 'Dataset' })
    await dbPut('drafts', { id: 'draft_1', title: 'Draft' })
    await setSetting('theme', 'dark')
    await clearAllData()
    expect(await dbGetAll('datasets')).toHaveLength(0)
    expect(await dbGetAll('drafts')).toHaveLength(0)
    expect(await getSetting('theme')).toBe('dark')
  })
})
