import { useEffect, useMemo, useState } from 'react'
import { History, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge, Button, Callout, Card, PageHeader, Select, Spinner } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { clearHistory, deleteVersion, listVersions, restoreVersion } from '../../lib/storage.js'
import { collectionLabel, groupVersions, recordLabel, versionSummary } from '../../lib/history.js'

type Version = {
  id: string
  store: string
  recordId: string
  record: Record<string, unknown>
  deleted: boolean
  reason: string
  createdAt: string
}

export default function VersionHistory() {
  const { notify, refreshToken, bumpRefresh } = useApp()
  const [versions, setVersions] = useState<Version[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  const load = async () => {
    try {
      setVersions(await listVersions({ limit: 150 }) as Version[])
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Version history could not be loaded.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [refreshToken])

  const stores = useMemo(() => [...new Set(versions.map((version) => version.store))].sort(), [versions])
  const groups = useMemo(() => {
    const filtered = filter === 'all' ? versions : versions.filter((version) => version.store === filter)
    return groupVersions(filtered)
  }, [filter, versions])

  const restore = async (version: Version) => {
    if (!window.confirm(`Restore ${versionSummary(version)}? Your current version will also be saved in history first.`)) return
    setBusyId(version.id)
    try {
      await restoreVersion(version.id)
      bumpRefresh()
      notify(`${recordLabel(version)} restored. A snapshot of the previous state was saved.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'This version could not be restored.', 'error')
    } finally {
      setBusyId('')
    }
  }

  const remove = async (version: Version) => {
    setBusyId(version.id)
    try {
      await deleteVersion(version.id)
      await load()
      notify('Snapshot deleted.', 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The snapshot could not be deleted.', 'error')
    } finally {
      setBusyId('')
    }
  }

  const clear = async () => {
    if (!window.confirm('Delete all saved snapshots? This removes undo points for past edits and cannot be undone.')) return
    try {
      await clearHistory()
      await load()
      bumpRefresh()
      notify('Version history cleared. Current records were not changed.', 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Version history could not be cleared.', 'error')
    }
  }

  return <div>
    <PageHeader eyebrow="WORKSPACE / HISTORY" title="Version history" description="Review bounded, local snapshots saved before edits and deletions. Restoring never overwrites history: the current state is snapshotted first."
      actions={<>
        <Badge tone="slate"><History size={11} /> {versions.length} snapshot{versions.length === 1 ? '' : 's'}</Badge>
        <Button variant="secondary" onClick={clear} disabled={!versions.length} icon={<Trash2 size={14} />}>Clear history</Button>
      </>}
    />

    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-slate-800">Saved changes</h2>
        <Select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by collection" className="w-auto min-w-[160px]">
          <option value="all">All collections</option>
          {stores.map((store) => <option key={store} value={store}>{collectionLabel(store)}</option>)}
        </Select>
      </div>

      {loading ? <div className="grid min-h-[30vh] place-items-center"><Spinner label="Opening version history…" /></div>
        : !groups.length ? <div className="grid min-h-[30vh] place-items-center text-center">
          <div>
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-500"><History size={20} /></div>
            <h3 className="mt-3 text-sm font-extrabold text-slate-700">No snapshots yet</h3>
            <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-slate-500">Edit or delete any saved record to create a local restore point. Snapshots stay in this browser and are capped automatically.</p>
          </div>
        </div>
          : <div className="space-y-4">
            {groups.map((group) => <section key={group.store}>
              <div className="mb-1.5 flex items-center gap-2">
                <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{group.label}</h3>
                <Badge tone="slate">{group.versions.length}</Badge>
              </div>
              <div className="space-y-1.5">
                {group.versions.map((version: Version) => <div key={version.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${version.deleted ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                    {version.deleted ? <Trash2 size={13} /> : <RotateCcw size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-bold text-slate-700">{versionSummary(version)}</div>
                    <div className="text-[9px] text-slate-400">{new Date(version.createdAt).toLocaleString()} · {version.recordId}</div>
                  </div>
                  <Button size="sm" variant="secondary" disabled={busyId === version.id} onClick={() => restore(version)} icon={<RotateCcw size={11} />}>Restore</Button>
                  <button type="button" onClick={() => remove(version)} aria-label="Delete snapshot" className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"><Trash2 size={12} /></button>
                </div>)}
              </div>
            </section>)}
          </div>}
    </Card>

    <Callout tone="info"><ShieldCheck size={12} /> Snapshots are local-only, bounded to 12 per record and 150 total. Large binary assets are skipped to protect browser storage quota.</Callout>
  </div>
}
