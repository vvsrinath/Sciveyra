import { Link } from 'react-router-dom'
import {
  ArrowRight, BookOpen, Box, Check, Compass, ExternalLink, FileImage, FileText, FlaskConical,
  Grid2X2, HardDrive, Image as ImageIcon, Layers, LineChart, Mail, MousePointer2, Network,
  Palette, Search, ShieldCheck, Sparkles, WandSparkles
} from 'lucide-react'
import Logo from '../../components/Logo'
import { copyrightLine } from '../../lib/siteMeta.js'

const workflow = [
  { icon: Search, title: 'Discover', detail: 'Find papers with free metadata sources.' },
  { icon: BookOpen, title: 'Organise', detail: 'Save references, notes and evidence.' },
  { icon: LineChart, title: 'Analyse', detail: 'Clean tables, statistics and 3D visuals.' },
  { icon: FileText, title: 'Write', detail: 'Draft with outlines and linked claims.' },
  { icon: ShieldCheck, title: 'Check', detail: 'Review claims and polish without paid AI.' }
]

const features = [
  { icon: LineChart, title: 'Scientific graphs', desc: 'CSV/Excel import, 10 chart types, statistics, fits and publication exports.', to: '/graphs', tint: 'from-blue-50 to-indigo-50 text-blue-600 ring-blue-100' },
  { icon: Layers, title: '3D graph studio', desc: 'Rotate real XYZ data as surfaces, meshes and 3D scatter plots.', to: '/three-d', tint: 'from-violet-50 to-fuchsia-50 text-violet-600 ring-violet-100' },
  { icon: Search, title: 'Reference Finder', desc: 'Search OpenAlex, DOAJ, Europe PMC, Crossref and arXiv with honest source errors.', to: '/navigator', tint: 'from-pink-50 to-rose-50 text-pink-600 ring-pink-100' },
  { icon: BookOpen, title: 'Reference Manager', desc: 'BibTeX/RIS library, deduplication, DOI lookup and formatted citations.', to: '/references', tint: 'from-amber-50 to-orange-50 text-amber-600 ring-amber-100' },
  { icon: FileText, title: 'Writing Lab', desc: 'Markdown drafts, outline templates and a claim–evidence map linked to sources.', to: '/writing', tint: 'from-emerald-50 to-teal-50 text-emerald-600 ring-emerald-100' },
  { icon: Compass, title: 'Research Toolkit', desc: 'Native equivalents plus an honest, licence-labelled external tool directory.', to: '/toolkit', tint: 'from-indigo-50 to-blue-50 text-indigo-600 ring-indigo-100' },
  { icon: ImageIcon, title: 'Image & Vector', desc: 'Crop, adjust and annotate images, or trace line art into clean SVG paths.', to: '/images', tint: 'from-cyan-50 to-sky-50 text-cyan-600 ring-cyan-100' },
  { icon: Grid2X2, title: 'Figure Composer', desc: 'Assemble multi-panel figures with live graphs and export PNG, SVG or PDF.', to: '/figures', tint: 'from-orange-50 to-amber-50 text-orange-600 ring-orange-100' }
]

const toolLinks = [
  { label: 'Graph Studio', to: '/graphs', icon: LineChart },
  { label: '3D Studio', to: '/three-d', icon: Layers },
  { label: 'Image Studio', to: '/images', icon: ImageIcon },
  { label: 'Vector Studio', to: '/vector', icon: FileImage },
  { label: 'Figure Composer', to: '/figures', icon: Grid2X2 },
  { label: 'Diagram Studio', to: '/diagrams', icon: Network },
  { label: 'Reference Finder', to: '/navigator', icon: Search },
  { label: 'Reference Manager', to: '/references', icon: BookOpen },
  { label: 'Writing Lab', to: '/writing', icon: FileText },
  { label: 'Paragraph Rewriter', to: '/rewriter', icon: WandSparkles },
  { label: 'Research Toolkit', to: '/toolkit', icon: Compass },
  { label: 'Feature Tester', to: '/tester', icon: FlaskConical },
  { label: 'Projects', to: '/projects', icon: Grid2X2 },
  { label: 'Version History', to: '/history', icon: HardDrive }
]

/* --- Decorative 3D surface mesh (pure SVG, no data claims) --------------- */

const GRID = 9

function surfaceZ(x: number, y: number) {
  const bump = Math.exp(-(x * x * 1.7 + y * y * 1.15))
  return bump * 0.9 + Math.sin(x * 4.1) * Math.cos(y * 3.3) * 0.13
}

function project(x: number, y: number) {
  const z = surfaceZ(x, y)
  return [260 + (x - y) * 158, 206 + (x + y) * 60 - z * 104] as const
}

const mesh = Array.from({ length: GRID }, (_, index) => -1 + (index * 2) / (GRID - 1))

function pathAlong(axis: 'x' | 'y', fixed: number) {
  return mesh.map((value, index) => {
    const [x, y] = axis === 'x' ? [fixed, value] : [value, fixed]
    const [px, py] = project(x, y)
    return `${index === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`
  }).join(' ')
}

const meshLinesX = mesh.map((fixed) => pathAlong('x', fixed))
const meshLinesY = mesh.map((fixed) => pathAlong('y', fixed))

function SurfaceMesh({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 520 380" className={className} role="img" aria-label="Decorative three-dimensional surface wireframe">
    <defs>
      <linearGradient id="meshStroke" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="48%" stopColor="#818cf8" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
      <radialGradient id="meshGlow" cx="50%" cy="52%" r="52%">
        <stop offset="0%" stopColor="#bfdbfe" stopOpacity=".9" />
        <stop offset="55%" stopColor="#e0e7ff" stopOpacity=".35" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c7d2fe" stopOpacity=".55" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <ellipse cx="260" cy="245" rx="235" ry="105" fill="url(#meshGlow)" />
    <ellipse cx="260" cy="292" rx="210" ry="72" fill="url(#floorFade)" opacity=".7" />
    {meshLinesX.map((d, index) => <path key={`x-${index}`} d={d} fill="none" stroke="url(#meshStroke)" strokeWidth={index % 2 === 0 ? 1.6 : 1} strokeLinecap="round" opacity={0.32 + index * 0.055} />)}
    {meshLinesY.map((d, index) => <path key={`y-${index}`} d={d} fill="none" stroke="url(#meshStroke)" strokeWidth={index % 2 === 0 ? 1.4 : 0.9} strokeLinecap="round" opacity={0.22 + index * 0.05} />)}
    {[0, 1, 2].map((ring) => <ellipse key={ring} cx="260" cy={318 + ring * 12} rx={150 - ring * 28} ry={34 - ring * 7} fill="none" stroke="#93c5fd" strokeOpacity={0.4 - ring * 0.09} strokeDasharray="2 6" />)}
  </svg>
}

/* ------------------------------------------------------------------------ */

export default function Landing() {
  return <div className="relative isolate min-h-screen overflow-hidden bg-white text-slate-900">
    {/* Glass-morphism ambient field: decorative, light-theme only. */}
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="glass-orb absolute -top-48 left-1/2 h-[620px] w-[980px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(191,219,254,.85),rgba(255,255,255,0))]" />
      <div className="glass-orb absolute -right-40 top-24 h-[520px] w-[520px] bg-[radial-gradient(closest-side,rgba(196,181,253,.62),rgba(255,255,255,0))]" />
      <div className="glass-orb absolute -left-40 top-[720px] h-[520px] w-[520px] bg-[radial-gradient(closest-side,rgba(165,243,252,.55),rgba(255,255,255,0))]" />
      <div className="grid-fade absolute inset-x-0 top-0 h-[720px]" />
    </div>

    <header className="glass-subtle sticky top-0 z-40 border-b border-white/80 bg-white/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-6 text-[12px] font-bold text-slate-500 lg:flex" aria-label="Landing navigation">
          <a href="#idea" className="transition hover:text-blue-600">The idea</a>
          <a href="#features" className="transition hover:text-blue-600">Features</a>
          <a href="#tools" className="transition hover:text-blue-600">Tool coverage</a>
          <Link to="/contact" className="transition hover:text-blue-600">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/toolkit" className="glass-chip hidden h-10 items-center gap-2 rounded-xl px-3.5 text-[12px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700 sm:inline-flex">
            <Compass size={15} /> Toolkit
          </Link>
          <Link to="/home" className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-3.5 text-[12px] font-bold text-white shadow-[0_12px_26px_-12px_rgba(37,99,235,.8)] transition hover:-translate-y-0.5 sm:px-4">
            Launch workspace <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </header>

    <main>
      {/* Hero ------------------------------------------------------------- */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.02fr_1fr] lg:gap-8 lg:px-8 lg:pb-20 lg:pt-20">
        <div className="animate-fade-up">
          <div className="glass-chip inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-slate-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Local-first scientific workspace
          </div>

          <h1 className="mt-6 font-display text-[42px] font-extrabold leading-[1.03] tracking-[-0.045em] text-slate-900 sm:text-[58px] lg:text-[66px]">
            The whole research loop.
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">One quiet workspace.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[14px] leading-[1.8] text-slate-500 sm:text-[15px]">
            SciVeyra is a free, open and browser-based desk for the entire research journey: find papers, save evidence, analyse data, build figures, write the manuscript and check your work. Your files stay in this browser — no account, no backend, no paid AI API.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/home" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 px-6 text-[13px] font-bold text-white shadow-[0_18px_38px_-14px_rgba(37,99,235,.8)] transition hover:-translate-y-0.5">
              Open SciVeyra <ArrowRight size={17} />
            </Link>
            <Link to="/toolkit" className="glass-chip inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-[13px] font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700">
              <Compass size={17} className="text-indigo-500" /> See the toolkit
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11.5px] font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-500" /> Private by default</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles size={15} className="text-blue-500" /> No AI keys</span>
            <span className="inline-flex items-center gap-1.5"><HardDrive size={15} className="text-violet-500" /> Local backup & restore</span>
          </div>
        </div>

        {/* Hero glass lab ------------------------------------------------- */}
        <div className="relative mx-auto w-full max-w-[560px] animate-fade-up [animation-delay:120ms]">
          <div className="absolute -inset-8 -z-10 rounded-[48px] bg-gradient-to-br from-blue-200/50 via-indigo-100/40 to-cyan-100/50 blur-3xl" />
          <div className="glass-hero relative overflow-hidden rounded-[30px] p-3 sm:p-4">
            <div className="glass-tile flex items-center justify-between rounded-2xl px-3.5 py-3 sm:px-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-2 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Local research desk</span>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-emerald-600 ring-1 ring-inset ring-emerald-100">Live</span>
            </div>

            <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white/90 via-blue-50/60 to-indigo-50/70">
              <SurfaceMesh className="h-auto w-full" />
              <div className="absolute left-3 top-3 flex flex-col gap-0.5 sm:left-4 sm:top-4">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">3D response</span>
                <span className="font-display text-[20px] font-extrabold tracking-tight text-slate-800">+ 42.7%</span>
                <span className="text-[9px] font-semibold text-slate-400">synthetic preview</span>
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-white/80 bg-white/75 px-3 py-2 backdrop-blur sm:left-4 sm:right-4">
                <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold text-slate-500"><MousePointer2 size={12} className="text-blue-500" /> Drag to rotate</span>
                <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold text-slate-500"><Palette size={12} className="text-violet-500" /> Viridis</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { icon: Search, label: 'Metadata', value: '5 sources' },
                { icon: LineChart, label: 'Analysis', value: '10 charts' },
                { icon: FileText, label: 'Draft', value: 'Markdown' }
              ].map((item) => <div key={item.label} className="glass-tile rounded-xl px-2.5 py-2">
                <item.icon size={13} className="text-blue-500" />
                <div className="mt-1 text-[8px] font-extrabold uppercase tracking-[0.1em] text-slate-400">{item.label}</div>
                <div className="truncate text-[10.5px] font-extrabold text-slate-700">{item.value}</div>
              </div>)}
            </div>
          </div>

          <div className="glass-tile absolute -left-5 top-[36%] hidden animate-floaty rounded-2xl p-3 sm:block">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600"><span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Check size={12} /></span> Analysis complete</div>
          </div>
          <div className="glass-tile absolute -right-4 bottom-14 hidden animate-floaty rounded-2xl p-3 [animation-delay:1.4s] sm:block">
            <div className="text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Stored locally</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-bold text-slate-700"><ShieldCheck size={13} className="text-emerald-500" /> IndexedDB</div>
          </div>
        </div>
      </section>

      {/* Stats ------------------------------------------------------------ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="glass-hero grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4">
          {[
            { value: `${toolLinks.length}`, label: 'Open routes in one desk' },
            { value: '5', label: 'Connected research stages' },
            { value: '0', label: 'Accounts or AI keys needed' },
            { value: '100%', label: 'Browser-first workflow' }
          ].map((stat) => <div key={stat.label} className="bg-white/55 px-4 py-5 sm:px-5 sm:py-6">
            <div className="font-display text-[24px] font-extrabold tracking-tight text-slate-900 sm:text-[27px]">{stat.value}</div>
            <div className="mt-1 text-[10.5px] font-semibold leading-snug text-slate-500">{stat.label}</div>
          </div>)}
        </div>
      </section>

      {/* The whole idea --------------------------------------------------- */}
      <section id="idea" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-blue-600">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400" /> The whole idea
          </div>
          <h2 className="mt-4 font-display text-[31px] font-extrabold leading-[1.1] tracking-[-0.035em] text-slate-900 sm:text-[40px]">Research rarely happens in one app.<br className="hidden sm:block" /> So we brought the useful parts together.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[13px] leading-relaxed text-slate-500">Instead of copying files between a search site, a spreadsheet, a reference manager and a word processor, SciVeyra keeps the chain connected locally. You can still use specialist tools when you need them — the Toolkit tells you which are free, which are open source and which are paid.</p>
        </div>

        <div className="mt-10 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {workflow.map((item, index) => <div key={item.title} className="glass-tile relative rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/90 text-blue-600 shadow-soft ring-1 ring-inset ring-blue-100"><item.icon size={18} /></span>
              <span className="font-display text-[11px] font-extrabold tracking-[0.16em] text-slate-300">0{index + 1}</span>
            </div>
            <h3 className="mt-3 text-[13.5px] font-extrabold text-slate-800">{item.title}</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{item.detail}</p>
          </div>)}
        </div>
      </section>

      {/* Features --------------------------------------------------------- */}
      <section id="features" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-indigo-600">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400" /> Built for curious minds
            </div>
            <h2 className="mt-3 font-display text-[31px] font-extrabold leading-[1.1] tracking-[-0.035em] text-slate-900 sm:text-[39px]">Everything you need to make research move.</h2>
          </div>
          <p className="max-w-sm text-[13px] leading-relaxed text-slate-500">Focused tools, a calm glass interface, and your work kept in your browser. No sign-up, no lock-in.</p>
        </div>

        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => <Link key={feature.title} to={feature.to} className="glass-tile group flex min-w-0 flex-col rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:border-blue-200">
            <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-inset ${feature.tint}`}><feature.icon size={20} /></div>
            <h3 className="mt-4 text-[14px] font-extrabold tracking-tight text-slate-900">{feature.title}</h3>
            <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-slate-500">{feature.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 opacity-0 transition group-hover:opacity-100">Open tool <ArrowRight size={13} /></span>
          </Link>)}
          <Link to="/contact" className="glass-hero group flex min-w-0 flex-col justify-between rounded-2xl bg-gradient-to-br from-blue-600/95 to-indigo-600/95 p-5 text-white transition duration-300 hover:-translate-y-1">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/25"><Mail size={20} /></span>
            <div>
              <h3 className="mt-4 text-[14px] font-extrabold tracking-tight">Questions or feedback?</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-blue-100">Meet the developer and open the public profiles.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold">Contact page <ArrowRight size={13} /></span>
            </div>
          </Link>
        </div>
      </section>

      {/* Honest tool coverage -------------------------------------------- */}
      <section id="tools" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
        <div className="glass-hero overflow-hidden rounded-[30px] p-5 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/80 px-3 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">
                <ShieldCheck size={13} /> Built in and working
              </div>
              <h2 className="mt-4 font-display text-[28px] font-extrabold leading-[1.12] tracking-[-0.035em] text-slate-900 sm:text-[34px]">Free, open and local first.</h2>
              <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-slate-500">These are real SciVeyra tools, not links in disguise. They run in your browser and save to local storage when you choose.</p>
              <ul className="mt-5 grid gap-2 text-[12px] font-semibold text-slate-600 sm:grid-cols-2">
                {['Reference Finder', 'Reference Manager', 'Graph & 3D Studio', 'Writing Lab', 'Paragraph Rewriter', 'Qualitative coder'].map((item) => <li key={item} className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/65 px-3 py-2"><Check size={13} className="text-emerald-500" />{item}</li>)}
              </ul>
              <Link to="/toolkit" className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-4 text-[12px] font-bold text-white shadow-[0_12px_26px_-12px_rgba(37,99,235,.8)] transition hover:-translate-y-0.5">
                Open the toolkit <ArrowRight size={14} />
              </Link>
            </div>

            <div className="glass-tile rounded-2xl p-5 sm:p-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                <ExternalLink size={13} /> External directory
              </div>
              <h3 className="mt-4 font-display text-[20px] font-extrabold tracking-tight text-slate-900">Specialist tools, clearly labelled.</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">Scopus, Turnitin, SPSS, Overleaf, Zotero, R and Python are shown with honest access labels. Paid or institutional services are never presented as native SciVeyra features.</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['Open source', 'Free tier', 'Institutional / paid', 'Proprietary'].map((label) => <span key={label} className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[9.5px] font-bold text-slate-500">{label}</span>)}
              </div>
              <Link to="/toolkit?tab=directory" className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/85 px-4 text-[12px] font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">
                Browse all tools <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <h3 className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Open directly from the workspace</h3>
          <div className="mx-auto mt-4 flex max-w-4xl flex-wrap justify-center gap-2">
            {toolLinks.map((tool) => <Link key={tool.label} to={tool.to} className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/70 hover:text-blue-700">
              <tool.icon size={13} className="text-blue-500" />{tool.label}
            </Link>)}
          </div>
        </div>
      </section>

      {/* Privacy ---------------------------------------------------------- */}
      <section id="privacy" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
        <div className="glass-hero flex flex-col items-start gap-5 rounded-[28px] p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/90 text-emerald-600 shadow-soft ring-1 ring-inset ring-emerald-100"><ShieldCheck size={22} /></div>
          <div className="flex-1">
            <h3 className="font-display text-[18px] font-extrabold tracking-tight text-slate-900">Your research. Your browser. Your control.</h3>
            <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-slate-500">Projects, datasets, figures and references stay in local browser storage. Back up and restore everything as JSON. Academic search contacts only the source you choose, provider errors are shown honestly, and rewriting is local unless you explicitly enable a self-hosted Ollama endpoint.</p>
          </div>
          <Link to="/settings" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-white/90 px-4 text-[12px] font-bold text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-50">
            Privacy controls <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </main>

    <footer className="border-t border-white/80 bg-white/65 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
        <Logo />
        <nav className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-bold text-slate-500" aria-label="Footer navigation">
          <a href="#idea" className="hover:text-blue-600">The idea</a>
          <Link to="/toolkit" className="hover:text-blue-600">Toolkit</Link>
          <Link to="/contact" className="hover:text-blue-600">Contact</Link>
          <Link to="/settings" className="hover:text-blue-600">Privacy</Link>
        </nav>
        <div className="text-center text-[10.5px] leading-relaxed text-slate-400 sm:text-right">
          <p className="font-bold text-slate-500">{copyrightLine()}</p>
          <p>Free, open and local-first.</p>
        </div>
      </div>
    </footer>
  </div>
}
