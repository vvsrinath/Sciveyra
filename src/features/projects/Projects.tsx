import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BookOpen, Database, FileImage, FileText, FolderOpen, Grid2X2, HardDrive,
  Image as ImageIcon, Layers, LineChart, Network, Plus, Search, ShieldCheck, Trash2, X
} from 'lucide-react'
import { Badge, Button, Card, PageHeader, Spinner } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { dbDelete, dbGetAll, storageEstimate } from '../../lib/storage.js'
import { formatBytes, pluralize } from '../../lib/util.js'
import type { Asset, Dataset, DiagramRecord, DraftRecord, FigureRecord, GraphRecord, Reference } from '../../types'

type Kind = 'dataset' | 'graph' | 'figure' | 'diagram' | 'draft' | 'reference' | 'asset'
type LibraryItem = {
  id: string
  name: string
  kind: Kind
  meta: string
  updatedAt: string
  to: string
  preview?: string
}

const kindMeta: Record<Kind, { label: string; icon: typeof Database; color: string }> = {
  dataset: { label: 'Dataset', icon: Database, color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300' },
  graph: { label: 'Graph', icon: LineChart, color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300' },
  figure: { label: 'Figure', icon: Grid2X2, color: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300' },
  diagram: { label: 'Diagram', icon: Network, color: 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-300' },
  draft: { label: 'Draft', icon: FileText, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' },
  reference: { label: 'Reference', icon: BookOpen, color: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300' },
  asset: { label: 'Asset', icon: ImageIcon, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
}

const filters: { id: 'all' | Kind; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'dataset', label: 'Datasets' }, { id: 'graph', label: 'Graphs' },
  { id: 'figure', label: 'Figures' }, { id: 'diagram', label: 'Diagrams' }, { id: 'draft', label: 'Drafts' },
  { id: 'reference', label: 'References' }, { id: 'asset', label: 'Assets' }
]

const storeByKind: Record<Kind, string> = {
  dataset: 'datasets', graph: 'graphs', figure: 'figures', diagram: 'diagrams', draft: 'drafts', reference: 'references', asset: 'assets'
}

export default function Projects() {
  const { notify, refreshToken, bumpRefresh } = useApp()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Kind>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('updated')
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [deleting, setDeleting] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [datasets, graphs, figures, diagrams, drafts, references, assets, estimate] = await Promise.all([
          dbGetAll('datasets') as Promise<Dataset[]>,
          dbGetAll('graphs') as Promise<GraphRecord[]>,
          dbGetAll('figures') as Promise<FigureRecord[]>,
          dbGetAll('diagrams') as Promise<DiagramRecord[]>,
          dbGetAll('drafts') as Promise<DraftRecord[]>,
          dbGetAll('references') as Promise<Reference[]>,
          dbGetAll('assets') as Promise<Asset[]>,
          storageEstimate()
        ])
        if (cancelled) return
        const list: LibraryItem[] = [
          ...datasets.map((item) => ({ id: item.id, name: item.name, kind: 'dataset' as const, meta: `${item.rowCount.toLocaleString()} rows · ${item.columnCount} columns · ${item.source}`, updatedAt: item.updatedAt, to: '/graphs' })),
          ...graphs.map((item) => ({ id: item.id, name: item.name, kind: 'graph' as const, meta: `${item.config?.plotType || 'graph'} · ${item.config?.xLabel || ''} → ${pluralize((item.config?.yKeys || []).length, 'series')}`, updatedAt: item.updatedAt, to: '/graphs' })),
          ...figures.map((item) => ({ id: item.id, name: item.name, kind: 'figure' as const, meta: `${pluralize(item.panels?.length || 0, 'panel')} · ${item.width}×${item.height} px`, updatedAt: item.updatedAt, to: '/figures' })),
          ...diagrams.map((item) => ({ id: item.id, name: item.name, kind: 'diagram' as const, meta: `${pluralize(item.nodes?.length || 0, 'node')} · ${pluralize(item.edges?.length || 0, 'connection')}`, updatedAt: item.updatedAt, to: '/diagrams' })),
          ...drafts.map((item) => ({ id: item.id, name: item.title, kind: 'draft' as const, meta: pluralize((item.content || '').split(/\s+/).filter(Boolean).length, 'word'), updatedAt: item.updatedAt, to: '/writing' })),
          ...references.map((item) => ({ id: item.id, name: item.title, kind: 'reference' as const, meta: [item.authors.slice(0, 2).join(', '), item.year, item.journal].filter(Boolean).join(' · ') || 'No metadata', updatedAt: item.updatedAt, to: '/references' })),
          ...assets.map((item) => ({ id: item.id, name: item.name, kind: 'asset' as const, meta: `${item.kind.toUpperCase()} · ${item.width && item.height ? `${item.width}×${item.height}` : 'figure asset'}`, updatedAt: item.updatedAt, to: '/figures', preview: item.kind === 'image' ? item.data : undefined }))
        ]
        setItems(list); setUsage(estimate)
      } catch (error) {
        notify(error instanceof Error ? error.message : 'The local library could not be loaded.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    let list = items.filter((item) => (filter === 'all' || item.kind === filter) && (!query || `${item.name} ${item.meta}`.toLowerCase().includes(query)))
    if (sort === 'title') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'kind') list = [...list].sort((a, b) => a.kind.localeCompare(b.kind))
    else list = [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    return list
  }, [items, filter, search, sort])

  const counts = useMemo(() => items.reduce<Record<string, number>>((acc, item) => { acc[item.kind] = (acc[item.kind] || 0) + 1; return acc }, {}), [items])

  const remove = async (item: LibraryItem) => {
    const warning = item.kind === 'dataset' ? 'Graphs that reference this dataset may stop rendering.' : ''
    if (!window.confirm(`Delete "${item.name}" from this browser?${warning ? `\n\n${warning}` : ''}`)) return
    setDeleting(item.id)
    try {
      await dbDelete(storeByKind[item.kind], item.id)
      setItems((current) => current.filter((entry) => !(entry.id === item.id && entry.kind === item.kind)))
      bumpRefresh()
      notify(`${kindMeta[item.kind].label} deleted.`, 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The item could not be deleted.', 'error')
    } finally {
      setDeleting('')
    }
  }

  const totalWords = items.filter((item) => item.kind === 'draft').reduce((sum, item) => sum + Number(item.meta.split(' ')[0]?.replace(/[^0-9]/g, '') || 0), 0)

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Spinner label="Reading your local library…" /></div>

  return <div>
    <PageHeader eyebrow="WORKSPACE / FILES" title="Projects & library" description="Every dataset, graph, figure, diagram, draft and reference saved in this browser."
      actions={<><Link to="/graphs" className="inline-flex"><Button variant="primary" icon={<Plus size={14} />}>New graph</Button></Link><Link to="/settings" className="inline-flex"><Button variant="secondary" icon={<HardDrive size={14} />}>Backup</Button></Link></>}
    />

    <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
      {[
        { label: 'Total items', value: items.length, icon: FolderOpen },
        { label: 'Graphs', value: (counts.graph || 0) + (counts.dataset || 0), icon: LineChart },
        { label: 'Figures & diagrams', value: (counts.figure || 0) + (counts.diagram || 0), icon: Grid2X2 },
        { label: 'References', value: counts.reference || 0, icon: BookOpen },
        { label: 'Draft words', value: totalWords, icon: FileText }
      ].map((stat) => <Card key={stat.label} className="flex items-center gap-2.5 p-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-300"><stat.icon size={15} /></span>
        <div><div className="text-lg font-extrabold leading-tight text-slate-800 dark:text-slate-100">{stat.value.toLocaleString()}</div><div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</div></div>
      </Card>)}
    </div>

    <Card className="p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
          <Search size={14} className="text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your library…" aria-label="Search library" className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none dark:text-slate-100" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="text-slate-400"><X size={12} /></button>}
        </div>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort library" className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <option value="updated">Recently updated</option><option value="title">Title</option><option value="kind">Type</option>
        </select>
        <div className="flex flex-wrap gap-1">
          {filters.map((entry) => <button key={entry.id} type="button" onClick={() => setFilter(entry.id)} className={`rounded-md border px-2 py-1 text-[9.5px] font-bold transition ${filter === entry.id ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 text-slate-500 hover:border-blue-200 dark:border-slate-700 dark:text-slate-400'}`}>
            {entry.label}{entry.id !== 'all' && counts[entry.id] ? ` ${counts[entry.id]}` : ''}
          </button>)}
        </div>
      </div>

      <div className="mt-3">
        {filtered.length ? <div className="grid gap-1.5 md:grid-cols-2">
          {filtered.map((item) => {
            const meta = kindMeta[item.kind]
            return <div key={`${item.kind}-${item.id}`} className="group flex items-center gap-2.5 rounded-lg border border-slate-100 p-2.5 transition hover:border-blue-200 hover:bg-blue-50/30 dark:border-slate-800 dark:hover:border-blue-900 dark:hover:bg-blue-950/20">
              <span className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg ${meta.color}`}>
                {item.preview ? <img src={item.preview} alt="" className="h-full w-full object-cover" /> : <meta.icon size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <Link to={item.to} className="block truncate text-[11px] font-bold text-slate-700 no-underline hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300">{item.name || 'Untitled'}</Link>
                <div className="mt-0.5 truncate text-[9.5px] text-slate-400"><span className="font-semibold">{meta.label}</span> · {item.meta} · {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</div>
              </div>
              <Link to={item.to} aria-label={`Open ${item.name}`} className="rounded p-1.5 text-slate-300 hover:text-blue-500"><ArrowRight size={13} /></Link>
              <button type="button" onClick={() => remove(item)} disabled={deleting === item.id} aria-label={`Delete ${item.name}`} className="rounded p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          })}
        </div> : <div className="grid min-h-[260px] place-items-center text-center">
          <div><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-300"><FolderOpen size={20} /></div>
            <h2 className="mt-3 text-sm font-extrabold text-slate-700 dark:text-slate-200">{items.length ? 'No matching items.' : 'Your project library is empty.'}</h2>
            <p className="mx-auto mt-1 max-w-sm text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{items.length ? 'Try another filter or search term.' : 'Start with Graph Studio to import data, or add a reference in the library.'}</p>
            <div className="mt-3 flex justify-center gap-1.5"><Link to="/graphs" className="inline-flex"><Button size="sm" icon={<LineChart size={12} />}>Open Graph Studio</Button></Link><Link to="/references" className="inline-flex"><Button size="sm" variant="secondary" icon={<BookOpen size={12} />}>Reference Manager</Button></Link></div>
          </div>
        </div>}
      </div>
    </Card>

    <div className="mt-3 grid gap-2 md:grid-cols-2">
      <Card className="flex items-start gap-2.5 p-3.5">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-500" />
        <div><h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Local by default</h2><p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">All items are stored in IndexedDB in this browser profile. Nothing here is uploaded to a SciVeyra server.</p></div>
      </Card>
      <Card className="flex items-start gap-2.5 p-3.5">
        <HardDrive size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <div><h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Storage {usage ? `· ${formatBytes(usage.usage)} used` : ''}</h2>
          {usage && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (usage.usage / Math.max(1, usage.quota)) * 100)}%` }} /></div>}
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Export a full JSON backup from Settings before clearing browser data or moving to another device.</p>
        </div>
      </Card>
    </div>
  </div>
}
