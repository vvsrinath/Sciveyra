import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Compass, ExternalLink,
  FileImage, FileText, FlaskConical, Grid2X2, HardDrive, Image as ImageIcon,
  Layers, LineChart, LockKeyhole, Mail, MousePointer2, Network, Palette, Search,
  ShieldCheck, Sparkles, WandSparkles
} from 'lucide-react'
import Logo from '../../components/Logo'
import { CONTACT, DEVELOPER_NAME, copyrightLine } from '../../lib/siteMeta.js'

const stages = [
  {
    icon: Search,
    title: 'Discover',
    detail: 'Search free metadata sources, with provider errors shown honestly.',
    tone: 'from-blue-500 to-cyan-500'
  },
  {
    icon: BookOpen,
    title: 'Organise',
    detail: 'Keep papers, notes, BibTeX and evidence in one local library.',
    tone: 'from-cyan-500 to-teal-500'
  },
  {
    icon: LineChart,
    title: 'Analyse',
    detail: 'Clean data, plot it, fit it and build figures you can export.',
    tone: 'from-teal-500 to-emerald-500'
  },
  {
    icon: FileText,
    title: 'Write',
    detail: 'Draft in Markdown or DOCX, import Word files and insert figures.',
    tone: 'from-emerald-500 to-lime-500'
  },
  {
    icon: ShieldCheck,
    title: 'Check',
    detail: 'Review claims, rewrite locally and stay in control of every change.',
    tone: 'from-indigo-500 to-violet-500'
  }
]

const features = [
  {
    icon: LineChart,
    title: 'Scientific graphs',
    desc: 'CSV/Excel import, 10 chart types, statistics, fits and publication exports.',
    to: '/graphs',
    tint: 'from-blue-500 to-indigo-500 text-blue-600 ring-blue-100',
    soft: 'from-blue-50 to-indigo-50'
  },
  {
    icon: Layers,
    title: '3D graph studio',
    desc: 'Rotate real XYZ data as surfaces, meshes and 3D scatter plots.',
    to: '/three-d',
    tint: 'from-violet-500 to-fuchsia-500 text-violet-600 ring-violet-100',
    soft: 'from-violet-50 to-fuchsia-50'
  },
  {
    icon: Search,
    title: 'Reference Finder',
    desc: 'OpenAlex, DOAJ, Europe PMC, Crossref and arXiv — no invented results.',
    to: '/navigator',
    tint: 'from-pink-500 to-rose-500 text-pink-600 ring-pink-100',
    soft: 'from-pink-50 to-rose-50'
  },
  {
    icon: BookOpen,
    title: 'Reference Manager',
    desc: 'BibTeX/RIS library, deduplication, DOI lookup and formatted citations.',
    to: '/references',
    tint: 'from-amber-500 to-orange-500 text-amber-600 ring-amber-100',
    soft: 'from-amber-50 to-orange-50'
  },
  {
    icon: FileText,
    title: 'Writing Lab',
    desc: 'Markdown, TXT and DOCX drafts with outlines and a claim–evidence map.',
    to: '/writing',
    tint: 'from-emerald-500 to-teal-500 text-emerald-600 ring-emerald-100',
    soft: 'from-emerald-50 to-teal-50'
  },
  {
    icon: Compass,
    title: 'Research Toolkit',
    desc: 'Native free equivalents plus an honest, licence-labelled tool directory.',
    to: '/toolkit',
    tint: 'from-indigo-500 to-blue-500 text-indigo-600 ring-indigo-100',
    soft: 'from-indigo-50 to-blue-50'
  },
  {
    icon: ImageIcon,
    title: 'Image & Vector',
    desc: 'Crop, adjust and annotate images, or trace line art into clean SVG paths.',
    to: '/images',
    tint: 'from-cyan-500 to-sky-500 text-cyan-600 ring-cyan-100',
    soft: 'from-cyan-50 to-sky-50'
  },
  {
    icon: Grid2X2,
    title: 'Figure Composer',
    desc: 'Assemble multi-panel figures with live graphs and export PNG, SVG or PDF.',
    to: '/figures',
    tint: 'from-orange-500 to-amber-500 text-orange-600 ring-orange-100',
    soft: 'from-orange-50 to-amber-50'
  }
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

const nativeTools = [
  'Reference Finder', 'Reference Manager', 'Graph & 3D Studio',
  'Writing Lab', 'Paragraph Rewriter', 'Qualitative coder'
]

const directoryLabels = ['Open source', 'Free tier', 'Institutional / paid', 'Proprietary']

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
  return (
    <svg viewBox="0 0 520 380" className={className} role="img" aria-label="Decorative three-dimensional surface wireframe">
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
      {meshLinesX.map((d, index) => (
        <path key={`x-${index}`} d={d} fill="none" stroke="url(#meshStroke)" strokeWidth={index % 2 === 0 ? 1.6 : 1} strokeLinecap="round" opacity={0.32 + index * 0.055} />
      ))}
      {meshLinesY.map((d, index) => (
        <path key={`y-${index}`} d={d} fill="none" stroke="url(#meshStroke)" strokeWidth={index % 2 === 0 ? 1.4 : 0.9} strokeLinecap="round" opacity={0.22 + index * 0.05} />
      ))}
      {[0, 1, 2].map((ring) => (
        <ellipse key={ring} cx="260" cy={318 + ring * 12} rx={150 - ring * 28} ry={34 - ring * 7} fill="none" stroke="#93c5fd" strokeOpacity={0.4 - ring * 0.09} strokeDasharray="2 6" />
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------------------ */

function useScrollReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])
}

export default function Landing() {
  useScrollReveal()

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white text-slate-900">
      {/* Ambient light field: decorative, light-theme only. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="landing-aurora absolute -top-56 left-1/2 h-[680px] w-[1100px] -translate-x-1/2" />
        <div className="glass-orb absolute -right-44 top-16 h-[540px] w-[540px] bg-[radial-gradient(closest-side,rgba(196,181,253,.6),rgba(255,255,255,0))]" />
        <div className="glass-orb absolute -left-44 top-[760px] h-[540px] w-[540px] bg-[radial-gradient(closest-side,rgba(165,243,252,.55),rgba(255,255,255,0))]" />
        <div className="grid-fade absolute inset-x-0 top-0 h-[760px]" />
      </div>

      <header className="glass-subtle sticky top-0 z-40 border-b border-white/80 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-[12px] font-bold text-slate-500 lg:flex" aria-label="Landing navigation">
            <a href="#idea" className="transition hover:text-blue-600">The idea</a>
            <a href="#features" className="transition hover:text-blue-600">Features</a>
            <a href="#tools" className="transition hover:text-blue-600">Tool coverage</a>
            <a href="#privacy" className="transition hover:text-blue-600">Privacy</a>
            <Link to="/contact" className="transition hover:text-blue-600">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="glass-chip hidden h-10 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold text-slate-500 md:inline-flex">
              <LockKeyhole size={13} className="text-emerald-500" /> No account
            </span>
            <Link to="/toolkit" className="glass-chip hidden h-10 items-center gap-2 rounded-xl px-3.5 text-[12px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700 sm:inline-flex">
              <Compass size={15} /> Toolkit
            </Link>
            <Link to="/home" className="group inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-3.5 text-[12px] font-bold text-white shadow-[0_12px_26px_-12px_rgba(37,99,235,.8)] transition hover:-translate-y-0.5 sm:px-4">
              Launch workspace <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero ------------------------------------------------------------- */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-12 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:px-8 lg:pb-20 lg:pt-20">
          <div className="animate-fade-up">
            <div className="glass-chip inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-slate-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Local-first scientific workspace
            </div>

            <h1 className="mt-6 font-display text-[42px] font-extrabold leading-[1.03] tracking-[-0.045em] text-slate-900 sm:text-[58px] lg:text-[68px]">
              The whole research loop.
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">One quiet workspace.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[14px] leading-[1.85] text-slate-500 sm:text-[15px]">
              Find papers, save evidence, analyse data, build figures, write the manuscript and check your work — without moving files between five different apps. Everything stays in this browser.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/home" className="group inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 px-6 text-[13px] font-bold text-white shadow-[0_18px_38px_-14px_rgba(37,99,235,.8)] transition hover:-translate-y-0.5">
                Open SciVeyra <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#idea" className="glass-chip inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-[13px] font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700">
                See how it works <ChevronRight size={16} className="text-indigo-500" />
              </a>
              <Link to="/toolkit" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[13px] font-bold text-slate-500 transition hover:text-blue-700">
                <Compass size={16} /> Toolkit
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11.5px] font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-500" /> Private by default</span>
              <span className="inline-flex items-center gap-1.5"><Sparkles size={15} className="text-blue-500" /> No AI keys</span>
              <span className="inline-flex items-center gap-1.5"><HardDrive size={15} className="text-violet-500" /> JSON backup & restore</span>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2 text-[10.5px] font-bold text-slate-400">
              <span>Free & open source</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Runs offline after load</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>No backend</span>
            </div>
          </div>

          {/* Hero glass lab ------------------------------------------------- */}
          <div className="relative mx-auto w-full max-w-[570px] animate-fade-up [animation-delay:120ms]">
            <div className="absolute -inset-10 -z-10 rounded-[54px] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(191,219,254,.55),rgba(224,242,254,.28),rgba(196,181,253,.45),rgba(191,219,254,.55))] blur-3xl" />
            <div className="glass-hero relative overflow-hidden rounded-[30px] p-3 sm:p-4">
              <div className="glass-tile flex items-center justify-between rounded-2xl px-3.5 py-3 sm:px-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  <span className="ml-2 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Local research desk</span>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-100">Live</span>
              </div>

              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto px-0.5 pb-0.5">
                {['Overview', 'Graphs', 'Draft'].map((tab, index) => (
                  <span key={tab} className={`shrink-0 rounded-lg px-2.5 py-1 text-[9.5px] font-bold ${index === 1 ? 'bg-blue-600 text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,.9)]' : 'text-slate-400'}`}>
                    {tab}
                  </span>
                ))}
                <span className="ml-auto shrink-0 text-[9px] font-semibold text-slate-400">v0.001</span>
              </div>

              <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white/90 via-blue-50/60 to-indigo-50/70">
                <SurfaceMesh className="h-auto w-full" />
                <div className="absolute left-3 top-3 flex flex-col gap-0.5 sm:left-4 sm:top-4">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">3D response</span>
                  <span className="font-display text-[20px] font-extrabold tracking-tight text-slate-800">+ 42.7%</span>
                  <span className="text-[9px] font-semibold text-slate-400">synthetic preview</span>
                </div>
                <span className="absolute right-3 top-3 rounded-full border border-white/80 bg-white/75 px-2.5 py-1 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-400 backdrop-blur">
                  Stage 03 · Analyse
                </span>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-white/80 bg-white/75 px-3 py-2 backdrop-blur sm:left-4 sm:right-4">
                  <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold text-slate-500"><MousePointer2 size={12} className="text-blue-500" /> Drag to rotate</span>
                  <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold text-slate-500"><Palette size={12} className="text-violet-500" /> Viridis</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { icon: Search, label: 'Sources', value: '5 connected' },
                  { icon: ImageIcon, label: 'Figures', value: 'PNG · SVG · PDF' },
                  { icon: FileText, label: 'Draft', value: 'Markdown · DOCX' }
                ].map((item) => (
                  <div key={item.label} className="glass-tile rounded-xl px-2.5 py-2">
                    <item.icon size={13} className="text-blue-500" />
                    <div className="mt-1 text-[8px] font-extrabold uppercase tracking-[0.1em] text-slate-400">{item.label}</div>
                    <div className="truncate text-[10.5px] font-extrabold text-slate-700">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-tile absolute -left-5 top-[36%] hidden animate-floaty rounded-2xl p-3 sm:block">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Check size={12} /></span>
                Analysis complete
              </div>
            </div>
            <div className="glass-tile absolute -right-4 bottom-14 hidden animate-floaty rounded-2xl p-3 [animation-delay:1.4s] sm:block">
              <div className="text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Stored locally</div>
              <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-bold text-slate-700"><ShieldCheck size={13} className="text-emerald-500" /> IndexedDB</div>
            </div>
          </div>
        </section>

        {/* Numbers --------------------------------------------------------- */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" data-reveal>
          <div className="glass-hero grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4">
            {[
              { value: `${toolLinks.length}`, label: 'Open routes in one desk' },
              { value: `${stages.length}`, label: 'Connected research stages' },
              { value: '0', label: 'Accounts or AI keys needed' },
              { value: '100%', label: 'Browser-first workflow' }
            ].map((stat) => (
              <div key={stat.label} className="bg-white/55 px-4 py-5 sm:px-5 sm:py-6">
                <div className="font-display text-[24px] font-extrabold tracking-tight text-slate-900 sm:text-[28px]">{stat.value}</div>
                <div className="mt-1 text-[10.5px] font-semibold leading-snug text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* The whole idea --------------------------------------------------- */}
        <section id="idea" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center" data-reveal>
            <div className="inline-flex items-center gap-2 text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-blue-600">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400" /> The whole idea
            </div>
            <h2 className="mt-4 font-display text-[31px] font-extrabold leading-[1.1] tracking-[-0.035em] text-slate-900 sm:text-[40px]">
              Research rarely happens in one app.<br className="hidden sm:block" /> So we brought the useful parts together.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[13px] leading-relaxed text-slate-500">
              Instead of copying files between a search site, a spreadsheet, a reference manager and a word processor, SciVeyra keeps the chain connected locally. Specialist tools remain available in the Toolkit with honest licence labels.
            </p>
          </div>

          <div className="relative mt-11">
            <div className="absolute left-[9%] right-[9%] top-[34px] hidden h-px bg-gradient-to-r from-blue-200 via-indigo-200 to-cyan-200 lg:block" aria-hidden="true" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {stages.map((stage, index) => (
                <div key={stage.title} data-reveal style={{ transitionDelay: `${index * 60}ms` }} className="glass-tile group relative rounded-2xl p-4 transition duration-300 hover:-translate-y-1 hover:border-blue-200">
                  <div className={`relative z-10 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${stage.tone} text-white shadow-[0_10px_22px_-12px_rgba(37,99,235,.9)] ring-1 ring-inset ring-white/40`}>
                    <stage.icon size={16} />
                  </div>
                  <span className="absolute right-4 top-4 font-display text-[11px] font-extrabold tracking-[0.16em] text-slate-300">0{index + 1}</span>
                  <h3 className="mt-3 text-[13.5px] font-extrabold text-slate-800">{stage.title}</h3>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{stage.detail}</p>
                  {index < stages.length - 1 && (
                    <ChevronRight size={14} className="absolute -right-3 top-7 hidden text-blue-300 lg:block" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features --------------------------------------------------------- */}
        <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end" data-reveal>
            <div>
              <div className="inline-flex items-center gap-2 text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-indigo-600">
                <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400" /> Built for curious minds
              </div>
              <h2 className="mt-3 font-display text-[31px] font-extrabold leading-[1.1] tracking-[-0.035em] text-slate-900 sm:text-[39px]">
                Everything you need to make research move.
              </h2>
            </div>
            <p className="max-w-sm text-[13px] leading-relaxed text-slate-500">
              Focused tools, a calm glass interface, and your work kept in your browser. No sign-up, no lock-in.
            </p>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <Link
                key={feature.title}
                to={feature.to}
                data-reveal
                style={{ transitionDelay: `${index * 45}ms` }}
                className="glass-tile group relative flex min-w-0 flex-col overflow-hidden rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:border-blue-200"
              >
                <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${feature.tint}`} aria-hidden="true" />
                <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${feature.tint} transition duration-300 group-hover:scale-105`}>
                  <feature.icon size={20} />
                </div>
                <h3 className="mt-4 text-[14px] font-extrabold tracking-tight text-slate-900">{feature.title}</h3>
                <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-slate-500">{feature.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 opacity-0 transition group-hover:opacity-100">
                  Open tool <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>

          <div data-reveal className="mt-4">
            <Link to="/contact" className="glass-hero group flex flex-col gap-4 rounded-2xl p-5 transition duration-300 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/90 text-blue-600 shadow-soft ring-1 ring-inset ring-blue-100"><Mail size={20} /></span>
                <div>
                  <h3 className="text-[14px] font-extrabold tracking-tight text-slate-900">Questions, ideas or feedback?</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-500">Meet the developer, see the public profiles and send a note from the contact page.</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-blue-700">
                Open contact <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
          </div>
        </section>

        {/* Honest tool coverage -------------------------------------------- */}
        <section id="tools" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
          <div className="glass-hero overflow-hidden rounded-[30px] p-5 sm:p-8 lg:p-10" data-reveal>
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/80 px-3 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">
                  <ShieldCheck size={13} /> Built in and working
                </div>
                <h2 className="mt-4 font-display text-[28px] font-extrabold leading-[1.12] tracking-[-0.035em] text-slate-900 sm:text-[34px]">
                  Free, open and local first.
                </h2>
                <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-slate-500">
                  These are real SciVeyra tools, not links in disguise. They run in your browser and save to local storage when you choose.
                </p>
                <ul className="mt-5 grid gap-2 text-[12px] font-semibold text-slate-600 sm:grid-cols-2">
                  {nativeTools.map((item) => (
                    <li key={item} className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/65 px-3 py-2">
                      <Check size={13} className="shrink-0 text-emerald-500" />{item}
                    </li>
                  ))}
                </ul>
                <Link to="/toolkit" className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-4 text-[12px] font-bold text-white shadow-[0_12px_26px_-12px_rgba(37,99,235,.8)] transition hover:-translate-y-0.5">
                  Open the toolkit <ArrowRight size={14} />
                </Link>
              </div>

              <div className="glass-tile rounded-2xl p-5 sm:p-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                  <ExternalLink size={13} /> External directory
                </div>
                <h3 className="mt-4 font-display text-[20px] font-extrabold tracking-tight text-slate-900">
                  Specialist tools, clearly labelled.
                </h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
                  Scopus, Turnitin, SPSS, Overleaf, Zotero, R and Python are shown with honest access labels. Paid or institutional services are never presented as native SciVeyra features.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {directoryLabels.map((label) => (
                    <span key={label} className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[9.5px] font-bold text-slate-500">{label}</span>
                  ))}
                </div>
                <Link to="/toolkit?tab=directory" className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/85 px-4 text-[12px] font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">
                  Browse all tools <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center" data-reveal>
            <h3 className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Open directly from the workspace</h3>
            <div className="mx-auto mt-4 flex max-w-4xl flex-wrap justify-center gap-2">
              {toolLinks.map((tool) => (
                <Link key={tool.label} to={tool.to} className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/70 hover:text-blue-700">
                  <tool.icon size={13} className="text-blue-500" />{tool.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy ---------------------------------------------------------- */}
        <section id="privacy" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-14 sm:px-6 lg:px-8 lg:pb-16">
          <div className="glass-hero flex flex-col items-start gap-5 rounded-[28px] p-6 sm:flex-row sm:items-center sm:p-8" data-reveal>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/90 text-emerald-600 shadow-soft ring-1 ring-inset ring-emerald-100"><ShieldCheck size={22} /></div>
            <div className="flex-1">
              <h3 className="font-display text-[18px] font-extrabold tracking-tight text-slate-900">Your research. Your browser. Your control.</h3>
              <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-slate-500">
                Projects, datasets, figures and references stay in local browser storage. Back up and restore everything as JSON. Academic search contacts only the source you choose, provider errors are shown honestly, and rewriting is local unless you explicitly enable a self-hosted Ollama endpoint.
              </p>
            </div>
            <Link to="/settings" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-white/90 px-4 text-[12px] font-bold text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-50">
              Privacy controls <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* Closing invitation ---------------------------------------------- */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="glass-hero relative overflow-hidden rounded-[32px] p-6 sm:p-9 lg:p-11" data-reveal>
            <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-blue-200/50 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-cyan-200/45 blur-3xl" aria-hidden="true" />
            <div className="relative grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-blue-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400" /> Ready when you are
                </div>
                <h2 className="mt-4 font-display text-[29px] font-extrabold leading-[1.12] tracking-[-0.035em] text-slate-900 sm:text-[38px]">
                  Start with a question.<br />Leave with a manuscript.
                </h2>
                <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-slate-500">
                  Open the workspace, create a project and connect the tools you need. SciVeyra stays out of the way so the research stays in focus.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link to="/home" className="group inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 px-6 text-[13px] font-bold text-white shadow-[0_18px_38px_-14px_rgba(37,99,235,.8)] transition hover:-translate-y-0.5">
                    Enter the workspace <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
                  </Link>
                  <Link to="/projects" className="glass-chip inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-[13px] font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700">
                    View projects <Grid2X2 size={16} className="text-indigo-500" />
                  </Link>
                </div>
                <p className="mt-5 text-[10.5px] font-semibold text-slate-400">
                  Built by {DEVELOPER_NAME} · Free, open and local-first.
                </p>
              </div>

              <div className="glass-tile rounded-2xl p-5 sm:p-6">
                <h3 className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Before you start</h3>
                <ul className="mt-4 grid gap-3">
                  {[
                    'No account or sign-in',
                    'Works from a static site',
                    'Your files stay in this browser',
                    'Export a JSON backup anytime'
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[12px] font-semibold text-slate-600">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check size={12} /></span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200/70 pt-4">
                  <a href={CONTACT.github} target="_blank" rel="noreferrer" className="glass-chip inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700">
                    GitHub <ExternalLink size={11} />
                  </a>
                  <a href={CONTACT.linkedin} target="_blank" rel="noreferrer" className="glass-chip inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700">
                    LinkedIn <ExternalLink size={11} />
                  </a>
                  <a href={`mailto:${CONTACT.email}`} className="glass-chip inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700">
                    Email <Mail size={11} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/80 bg-white/65 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-9 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[11px] leading-relaxed text-slate-400">
              A quiet, local-first desk for the whole research loop.
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Explore</h4>
            <nav className="mt-3 flex flex-col gap-2 text-[11px] font-bold text-slate-500" aria-label="Footer navigation">
              <a href="#idea" className="transition hover:text-blue-600">The idea</a>
              <a href="#features" className="transition hover:text-blue-600">Features</a>
              <Link to="/toolkit" className="transition hover:text-blue-600">Toolkit</Link>
              <Link to="/projects" className="transition hover:text-blue-600">Projects</Link>
            </nav>
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Connect</h4>
            <nav className="mt-3 flex flex-col gap-2 text-[11px] font-bold text-slate-500" aria-label="Contact navigation">
              <Link to="/contact" className="transition hover:text-blue-600">Contact page</Link>
              <a href={CONTACT.github} target="_blank" rel="noreferrer" className="transition hover:text-blue-600">GitHub</a>
              <a href={CONTACT.linkedin} target="_blank" rel="noreferrer" className="transition hover:text-blue-600">LinkedIn</a>
              <a href={`mailto:${CONTACT.email}`} className="transition hover:text-blue-600">Email</a>
            </nav>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <h4 className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Built by</h4>
            <p className="mt-3 text-[12px] font-extrabold text-slate-700">{DEVELOPER_NAME}</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
              Free, open and local-first.
            </p>
            <p className="mt-3 text-[10.5px] font-bold text-slate-500">{copyrightLine()}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
