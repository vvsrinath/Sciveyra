import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BookOpen, Compass, Database, FileImage, FileText, FlaskConical, FolderOpen, Grid2X2, HardDrive,
  Image as ImageIcon, Layers, LineChart, Network, Search, ShieldCheck, Sparkles, WandSparkles
} from 'lucide-react'
import { Badge, Card, Spinner } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { dbGetAll, storageEstimate } from '../../lib/storage.js'
import { formatBytes } from '../../lib/util.js'
import type { Dataset, DiagramRecord, DraftRecord, FigureRecord, GraphRecord, Reference } from '../../types'

const quickTools = [
  { title: 'Graph Studio', desc: 'Import data, plot, analyse and export', to: '/graphs', icon: LineChart, tint: 'from-blue-50 to-indigo-50 text-blue-600 ring-blue-100' },
  { title: '3D Graph Studio', desc: 'Surface, mesh and 3D scatter', to: '/three-d', icon: Layers, tint: 'from-violet-50 to-fuchsia-50 text-violet-600 ring-violet-100' },
  { title: 'Image Studio', desc: 'Crop, adjust and export images', to: '/images', icon: ImageIcon, tint: 'from-emerald-50 to-teal-50 text-emerald-600 ring-emerald-100' },
  { title: 'Vector Studio', desc: 'Trace raster art into SVG', to: '/vector', icon: FileImage, tint: 'from-cyan-50 to-sky-50 text-cyan-600 ring-cyan-100' },
  { title: 'Figure Composer', desc: 'Build multi-panel figures', to: '/figures', icon: Grid2X2, tint: 'from-orange-50 to-amber-50 text-orange-600 ring-orange-100' },
  { title: 'Diagram Studio', desc: 'Map methods and study flows', to: '/diagrams', icon: Network, tint: 'from-cyan-50 to-sky-50 text-cyan-600 ring-cyan-100' },
  { title: 'Research Toolkit', desc: 'Native equivalents and honest tool directory', to: '/toolkit', icon: Compass, tint: 'from-indigo-50 to-blue-50 text-indigo-600 ring-indigo-100' },
  { title: 'Reference Finder', desc: 'Search free open-access metadata', to: '/navigator', icon: Search, tint: 'from-pink-50 to-rose-50 text-pink-600 ring-pink-100' },
  { title: 'Reference Manager', desc: 'BibTeX/RIS library and citations', to: '/references', icon: BookOpen, tint: 'from-amber-50 to-orange-50 text-amber-600 ring-amber-100' },
  { title: 'Writing Lab', desc: 'Drafts, outlines and claim evidence', to: '/writing', icon: FileText, tint: 'from-emerald-50 to-teal-50 text-emerald-600 ring-emerald-100' },
  { title: 'Paragraph Rewriter', desc: 'Humanise prose without a paid AI API', to: '/rewriter', icon: WandSparkles, tint: 'from-violet-50 to-purple-50 text-violet-600 ring-violet-100' },
  { title: 'Feature Tester', desc: 'Run built-in checks across every tool', to: '/tester', icon: FlaskConical, tint: 'from-slate-50 to-blue-50 text-blue-600 ring-blue-100' }
]

type Item = { id: string; name: string; kind: string; to: string; updatedAt: string }

const kindTint: Record<string, string> = {
  Dataset: 'bg-blue-50 text-blue-600',
  Graph: 'bg-indigo-50 text-indigo-600',
  Figure: 'bg-orange-50 text-orange-600',
  Diagram: 'bg-cyan-50 text-cyan-600',
  Draft: 'bg-violet-50 text-violet-600',
  Reference: 'bg-pink-50 text-pink-600'
}

export default function Home() {
  const { refreshToken } = useApp()
  const [loading, setLoading] = useState(true)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [graphs, setGraphs] = useState<GraphRecord[]>([])
  const [figures, setFigures] = useState<FigureRecord[]>([])
  const [diagrams, setDiagrams] = useState<DiagramRecord[]>([])
  const [drafts, setDrafts] = useState<DraftRecord[]>([])
  const [references, setReferences] = useState<Reference[]>([])
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [d, g, f, di, dr, r, estimate] = await Promise.all([
          dbGetAll('datasets') as Promise<Dataset[]>,
          dbGetAll('graphs') as Promise<GraphRecord[]>,
          dbGetAll('figures') as Promise<FigureRecord[]>,
          dbGetAll('diagrams') as Promise<DiagramRecord[]>,
          dbGetAll('drafts') as Promise<DraftRecord[]>,
          dbGetAll('references') as Promise<Reference[]>,
          storageEstimate()
        ])
        if (cancelled) return
        setDatasets(d); setGraphs(g); setFigures(f); setDiagrams(di); setDrafts(dr); setReferences(r); setUsage(estimate)
      } catch {
        /* the shell already reports storage status */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refreshToken])

  const recent = useMemo(() => {
    const items: Item[] = [
      ...datasets.map((item) => ({ id: item.id, name: item.name, kind: 'Dataset', to: '/graphs', updatedAt: item.updatedAt })),
      ...graphs.map((item) => ({ id: item.id, name: item.name, kind: 'Graph', to: '/graphs', updatedAt: item.updatedAt })),
      ...figures.map((item) => ({ id: item.id, name: item.name, kind: 'Figure', to: '/figures', updatedAt: item.updatedAt })),
      ...diagrams.map((item) => ({ id: item.id, name: item.name, kind: 'Diagram', to: '/diagrams', updatedAt: item.updatedAt })),
      ...drafts.map((item) => ({ id: item.id, name: item.title, kind: 'Draft', to: '/writing', updatedAt: item.updatedAt })),
      ...references.map((item) => ({ id: item.id, name: item.title, kind: 'Reference', to: '/references', updatedAt: item.updatedAt }))
    ]
    return items.filter((item) => item.updatedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 7)
  }, [datasets, graphs, figures, diagrams, drafts, references])

  const totals = [
    { label: 'Datasets', value: datasets.length, to: '/graphs', icon: Database, tint: 'bg-blue-50 text-blue-600' },
    { label: 'Graphs', value: graphs.length, to: '/graphs', icon: LineChart, tint: 'bg-indigo-50 text-indigo-600' },
    { label: 'Figures', value: figures.length, to: '/figures', icon: Grid2X2, tint: 'bg-orange-50 text-orange-600' },
    { label: 'References', value: references.length, to: '/references', icon: BookOpen, tint: 'bg-pink-50 text-pink-600' }
  ]

  return <div className="space-y-4">
    {/* Welcome hero */}
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-blue-50/60 to-indigo-50/60 p-6 shadow-card sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-blue-200/60 to-violet-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-100/70 to-white blur-3xl" />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-600">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400" /> Your workspace
          </div>
          <h1 className="mt-3 font-display text-[32px] font-extrabold leading-[1.05] tracking-[-0.04em] text-slate-900 sm:text-[42px]">Make the next discovery.</h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-slate-500">A local-first research desk for data, graphs, 3D visuals, figures, references and writing — all in one calm, private space.</p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Link to="/graphs" className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 text-[12.5px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(37,99,235,.7)] transition hover:-translate-y-0.5">
              <Sparkles size={15} /> Open Graph Studio
            </Link>
            <Link to="/three-d" className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[12.5px] font-bold text-slate-700 shadow-soft transition hover:-translate-y-0.5 hover:border-slate-300">
              <Layers size={15} className="text-violet-500" /> Explore 3D
            </Link>
            <Link to="/toolkit" className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[12.5px] font-bold text-slate-600 transition hover:bg-white/70 hover:text-slate-900">
              <Compass size={15} /> Toolkit
            </Link>
            <Link to="/references" className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[12.5px] font-bold text-slate-600 transition hover:bg-white/70 hover:text-slate-900">
              <BookOpen size={15} /> Library
            </Link>
          </div>
        </div>

        <div className="hidden justify-self-end lg:block">
          <div className="relative h-[176px] w-[286px]">
            <div className="absolute left-0 top-1 w-[210px] rotate-[-4deg] rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-lift backdrop-blur">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><LineChart size={12} className="text-blue-500" /> 2D analysis</div>
              <svg viewBox="0 0 200 56" className="mt-2 w-full" aria-hidden="true">
                <path d="M4 46 C24 44 30 24 48 30 S74 48 92 26 S124 12 140 22 S170 12 196 8" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="140" cy="22" r="3" fill="#2563eb" />
              </svg>
            </div>
            <div className="absolute bottom-0 right-0 w-[224px] rotate-[3deg] rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-lift backdrop-blur">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><Layers size={12} className="text-violet-500" /> 3D surface</div>
              <div className="mt-2 flex items-end gap-1">
                {[30, 46, 38, 62, 52, 74, 60, 84, 70, 92].map((height, index) => <span key={index} className="flex-1 rounded-t bg-gradient-to-t from-indigo-200 to-violet-500" style={{ height: `${height * 0.42}px` }} />)}
              </div>
            </div>
            <div className="absolute -right-2 top-0 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 shadow-soft"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> Local</div>
          </div>
        </div>
      </div>
    </section>

    {/* Totals */}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {totals.map((total) => <Link key={total.label} to={total.to} className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lift">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${total.tint}`}><total.icon size={18} /></span>
        <span className="min-w-0">
          <span className="block font-display text-[22px] font-extrabold leading-none tracking-tight text-slate-900">{total.value}</span>
          <span className="mt-1 block text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">{total.label}</span>
        </span>
        <ArrowRight size={14} className="ml-auto text-slate-300 transition group-hover:text-blue-500" />
      </Link>)}
    </div>

    {/* Quick tools */}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {quickTools.map((tool) => <Link key={tool.title} to={tool.to} className="group flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lift">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-inset ${tool.tint}`}><tool.icon size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[13px] font-extrabold tracking-tight text-slate-800">{tool.title}<ArrowRight size={13} className="ml-auto text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" /></span>
          <span className="mt-1 block text-[11.5px] leading-relaxed text-slate-500">{tool.desc}</span>
        </span>
      </Link>)}
    </div>

    {/* Recent + rail */}
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.72fr)]">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-extrabold tracking-tight text-slate-900">Recent work</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">Saved in this browser</p>
          </div>
          <Link to="/projects" className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline">View library <ArrowRight size={12} /></Link>
        </div>
        {loading ? <div className="grid min-h-[180px] place-items-center"><Spinner label="Reading local library…" /></div>
          : recent.length ? <div className="-mx-2 divide-y divide-slate-100">{recent.map((item) => <Link key={`${item.kind}-${item.id}`} to={item.to} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 no-underline transition hover:bg-slate-50">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${kindTint[item.kind] || 'bg-slate-100 text-slate-500'}`}><FolderOpen size={15} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold text-slate-700">{item.name}</span>
              <span className="mt-0.5 block text-[10px] text-slate-400">{item.kind} · {new Date(item.updatedAt).toLocaleDateString()}</span>
            </span>
            <ArrowRight size={14} className="text-slate-300 transition group-hover:text-blue-500" />
          </Link>)}</div>
            : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-blue-500 shadow-soft"><LineChart size={24} /></div>
              <p className="mt-3 text-[12.5px] font-bold text-slate-700">Your workspace is ready.</p>
              <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-slate-400">Open Graph Studio to import a CSV/Excel file or explore a clearly labelled synthetic sample dataset.</p>
              <Link to="/graphs" className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline">Start with Graph Studio <ArrowRight size={12} /></Link>
            </div>}
      </Card>

      <div className="space-y-3">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-extrabold tracking-tight text-slate-900">Library totals</h2><Badge tone="green">local</Badge></div>
          <div className="grid grid-cols-2 gap-2">
            {totals.map((total) => <Link key={total.label} to={total.to} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 no-underline transition hover:border-blue-200 hover:bg-blue-50/40">
              <total.icon size={14} className="text-blue-500" />
              <div className="mt-2 font-display text-[19px] font-extrabold leading-none text-slate-900">{total.value}</div>
              <div className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-400">{total.label}</div>
            </Link>)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600"><HardDrive size={14} /></span><h2 className="text-[15px] font-extrabold tracking-tight text-slate-900">Local data</h2></div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-500">Files and projects stay in this browser's IndexedDB. Export a JSON backup before clearing site data or moving devices.</p>
          {usage ? <div className="mt-3"><div className="flex justify-between text-[10px] font-medium text-slate-400"><span>{formatBytes(usage.usage)} used</span><span>{formatBytes(usage.quota)} available</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${Math.min(100, (usage.usage / Math.max(1, usage.quota)) * 100)}%` }} /></div></div> : null}
          <Link to="/settings" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline">Backup & privacy <ArrowRight size={11} /></Link>
        </Card>

        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-5">
          <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><ShieldCheck size={14} /></span><h2 className="text-[15px] font-extrabold tracking-tight text-slate-900">Honest by design</h2></div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-500">No AI API keys, no fabricated citations, and no silent uploads. Sample data is explicitly synthetic. Online searches contact the chosen provider only when you search.</p>
        </Card>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 text-[10.5px] text-slate-400">
      <FileText size={12} /> Writing Lab uses local, rule-based checks — it is not an AI detector.
      <span className="text-slate-300">·</span>
      <Network size={12} /> 3D scenes are rendered with Plotly.js and stay in your browser.
    </div>
  </div>
}
