import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine, Check, HardDrive, Info, RefreshCw, ShieldCheck,
  TriangleAlert, Upload, X
} from 'lucide-react'
import { Badge, Button, Callout, Card, PageHeader } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import {
  clearAllData, exportBackup, importBackup, migrateLegacyData, storageEstimate
} from '../../lib/storage.js'
import { downloadJSON, readFileAsText } from '../../lib/export.js'
import { formatBytes, nowIso } from '../../lib/util.js'

type Counts = Record<string, number>

export default function Settings() {
  const { notify, bumpRefresh, refreshToken, storageError } = useApp()
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [counts, setCounts] = useState<Counts>({})
  const [busy, setBusy] = useState('')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const restoreRef = useRef<HTMLInputElement>(null)

  const loadCounts = async () => {
    try {
      const backup = await exportBackup()
      const next: Counts = {}
      for (const [store, records] of Object.entries(backup.data)) next[store] = Array.isArray(records) ? records.length : 0
      setCounts(next)
      setUsage(await storageEstimate())
    } catch {
      /* storage estimate is optional */
    }
  }

  useEffect(() => {
    loadCounts()
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
      navigator.storage.persisted().then(setPersisted).catch(() => setPersisted(null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  const backup = async () => {
    setBusy('backup')
    try {
      const payload = await exportBackup()
      downloadJSON(payload, `sciveyra-backup-${nowIso().slice(0, 10)}.json`)
      notify('Full local backup downloaded. Keep this file somewhere safe.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The backup could not be created.', 'error')
    } finally {
      setBusy('')
    }
  }

  const restore = async (file?: File) => {
    if (!file) return
    if (!window.confirm('Restore this backup? Existing items in the included collections will be replaced.')) {
      if (restoreRef.current) restoreRef.current.value = ''
      return
    }
    setBusy('restore')
    try {
      const text = await readFileAsText(file)
      const payload = JSON.parse(text)
      const result = await importBackup(payload, { mode: 'replace' })
      await loadCounts()
      bumpRefresh()
      notify(`Backup restored: ${Object.values(result).reduce((sum, value) => sum + value, 0).toLocaleString()} records imported.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The backup could not be restored. Check the file and schema version.', 'error')
    } finally {
      setBusy('')
      if (restoreRef.current) restoreRef.current.value = ''
    }
  }

  const clear = async () => {
    if (!window.confirm('Delete all datasets, graphs, figures, diagrams, drafts, references and assets from this browser?\n\nExport a backup first. This cannot be undone.')) return
    if (!window.confirm('Final confirmation: permanently clear local research data?')) return
    setBusy('clear')
    try {
      await clearAllData()
      await loadCounts()
      bumpRefresh()
      notify('Local research data cleared. Settings were preserved.', 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Local data could not be cleared.', 'error')
    } finally {
      setBusy('')
    }
  }

  const migrate = async () => {
    setBusy('migrate')
    try {
      const result = await migrateLegacyData()
      await loadCounts()
      bumpRefresh()
      notify(result.migrated ? `Imported ${result.count || 0} legacy records from this browser.` : 'No un-migrated legacy data was found.', result.migrated ? 'success' : 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Legacy data could not be imported.', 'error')
    } finally {
      setBusy('')
    }
  }

  const requestPersistence = async () => {
    setBusy('persist')
    try {
      if (!navigator.storage?.persist) { notify('This browser does not support persistent storage requests.', 'warning'); return }
      const granted = await navigator.storage.persist()
      setPersisted(granted)
      notify(granted ? 'Persistent storage granted. The browser is less likely to evict your data.' : 'The browser did not grant persistent storage. Export backups regularly.', granted ? 'success' : 'warning')
    } catch {
      notify('The persistence request failed.', 'error')
    } finally {
      setBusy('')
    }
  }

  const totalRecords = Object.entries(counts).filter(([store]) => !['settings', 'meta'].includes(store)).reduce((sum, [, value]) => sum + value, 0)

  return <div>
    <PageHeader eyebrow="Preferences" title="Settings" description="Control local data, backups and privacy for this browser-only workspace."
      actions={<Button variant="primary" onClick={backup} disabled={busy === 'backup'} icon={<ArrowDownToLine size={14} />}>{busy === 'backup' ? 'Preparing…' : 'Export backup'}</Button>}
    />

    <div className="grid items-start gap-3 lg:grid-cols-2">
      <div className="space-y-3">
        <Card className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-slate-100"><HardDrive size={16} className="text-blue-500" />Local storage</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Your work is stored in this browser's IndexedDB. Clearing site data, using private windows, or changing devices can remove it.</p>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div><div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{totalRecords.toLocaleString()} saved records</div><div className="text-[9.5px] text-slate-400">{usage ? `${formatBytes(usage.usage)} used` : 'Storage estimate unavailable'}{persisted === true ? ' · persistent' : persisted === false ? ' · best-effort' : ''}</div></div>
            <Badge tone={storageError ? 'amber' : 'green'}>{storageError ? 'fallback' : 'IndexedDB'}</Badge>
          </div>
          {usage && <div className="mt-2"><div className="flex justify-between text-[9px] text-slate-400"><span>Usage</span><span>{formatBytes(usage.quota)} quota</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (usage.usage / Math.max(1, usage.quota)) * 100)}%` }} /></div></div>}
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {Object.entries(counts).filter(([store]) => !['settings', 'meta'].includes(store)).map(([store, value]) => <div key={store} className="rounded-md border border-slate-100 p-2 dark:border-slate-800"><div className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{value}</div><div className="text-[9px] uppercase tracking-wide text-slate-400">{store}</div></div>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => restoreRef.current?.click()} disabled={busy === 'restore'} icon={<Upload size={12} />}>{busy === 'restore' ? 'Restoring…' : 'Restore backup'}</Button>
            <Button size="sm" variant="ghost" onClick={requestPersistence} disabled={busy === 'persist' || persisted === true} icon={<ShieldCheck size={12} />}>{persisted === true ? 'Persistent storage on' : 'Request persistence'}</Button>
            <Button size="sm" variant="ghost" onClick={migrate} disabled={busy === 'migrate'} icon={<RefreshCw size={12} />}>Import legacy data</Button>
          </div>
          <input ref={restoreRef} type="file" accept=".json,application/json" hidden onChange={(event) => restore(event.target.files?.[0])} aria-label="Restore SciVeyra backup" />
        </Card>

        <Card className="border-red-100 p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-slate-100"><TriangleAlert size={16} className="text-red-500" />Danger zone</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Remove all research items from this browser. Settings and the database schema are kept. Export a backup first.</p>
          <Button className="mt-3" size="sm" variant="danger" onClick={clear} disabled={busy === 'clear'} icon={<X size={12} />}>{busy === 'clear' ? 'Clearing…' : 'Clear local research data'}</Button>
        </Card>
      </div>

      <div className="space-y-3">
        <Card className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-slate-100"><ShieldCheck size={16} className="text-emerald-500" />Privacy & limitations</h2>
          <ul className="mt-2 space-y-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />No account, analytics profile, paid API or AI API is required.</li>
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />Images, spreadsheets and drafts are processed in this browser.</li>
            <li className="flex gap-2"><Info size={12} className="mt-0.5 shrink-0 text-blue-500" />Reference Finder contacts only the sources you choose when you search. OpenAlex and DOAJ are called directly; Crossref, Europe PMC, arXiv and Unpaywall may use same-origin Netlify proxies for browser access. No keys are sent.</li>
            <li className="flex gap-2"><Info size={12} className="mt-0.5 shrink-0 text-blue-500" />Unpaywall enrichment needs your own email, stored only in this browser. IP/patent and pattern rows open external search websites; they are links, not fabricated results.</li>
            <li className="flex gap-2"><Info size={12} className="mt-0.5 shrink-0 text-blue-500" />Paragraph rewriting is local and deterministic by default. An Ollama endpoint/model, if you enter one, is stored only in this browser and contacted only when you choose that mode.</li>
            <li className="flex gap-2"><Info size={12} className="mt-0.5 shrink-0 text-blue-500" />Sample datasets are explicitly labelled synthetic and must not be treated as experimental evidence.</li>
            <li className="flex gap-2"><TriangleAlert size={12} className="mt-0.5 shrink-0 text-amber-500" />Browser storage is not a backup. Export JSON backups regularly.</li>
            <li className="flex gap-2"><TriangleAlert size={12} className="mt-0.5 shrink-0 text-amber-500" />Writing checks are simple heuristics, not a grammar checker or AI detector.</li>
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">About this build</h2>
          <dl className="mt-2 space-y-1.5 text-[10px]">
            {[['Application', 'SciVeyra research workspace'], ['Version', '0.1.0 · local-first frontend'], ['Storage schema', 'IndexedDB v1'], ['Deployment', 'Static SPA (Netlify-compatible)'], ['Charting', 'Plotly.js (open source)'], ['Spreadsheets', 'PapaParse + ExcelJS']].map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0 dark:border-slate-800"><dt className="text-slate-400">{label}</dt><dd className="text-right font-semibold text-slate-600 dark:text-slate-300">{value}</dd></div>)}
          </dl>
          <Callout tone="info">This build does not claim to validate, peer-review or scientifically certify any analysis. Check methods against your field's standards.</Callout>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Backup contents</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">A backup is a JSON file containing all local collections, including datasets, graph settings, figure layouts, diagrams, drafts, references and exported assets. Keep it private — it may contain unpublished research.</p>
          <Button className="mt-2" size="sm" variant="secondary" onClick={backup} disabled={busy === 'backup'} icon={<ArrowDownToLine size={12} />}>Download JSON backup</Button>
        </Card>
      </div>
    </div>
  </div>
}
