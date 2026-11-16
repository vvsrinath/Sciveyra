import { Link } from 'react-router-dom'
import {
  ArrowRight, BookOpen, Box, Check, FileImage, FileText, Grid2X2, HardDrive,
  Image as ImageIcon, Layers, LineChart, MousePointer2, Network, Palette, Search,
  ShieldCheck, Sparkles
} from 'lucide-react'
import Logo from '../../components/Logo'

const features = [
  { icon: LineChart, title: 'Scientific graphs', desc: 'Import CSV or Excel, plot 2D charts, run statistics and export publication-ready figures.', to: '/graphs', tint: 'from-blue-50 to-indigo-50 text-blue-600 ring-blue-100' },
  { icon: Layers, title: '3D graph studio', desc: 'Rotate real XYZ data as surfaces, meshes and 3D scatter plots with rich colour scales.', to: '/three-d', tint: 'from-violet-50 to-fuchsia-50 text-violet-600 ring-violet-100' },
  { icon: ImageIcon, title: 'Image studio', desc: 'Crop, resize, adjust and annotate microscopy or lab images without uploading them.', to: '/images', tint: 'from-emerald-50 to-teal-50 text-emerald-600 ring-emerald-100' },
  { icon: FileImage, title: 'Vector studio', desc: 'Trace suitable raster artwork into editable SVG paths for crisp, scalable figures.', to: '/vector', tint: 'from-cyan-50 to-sky-50 text-cyan-600 ring-cyan-100' },
  { icon: Grid2X2, title: 'Figure composer', desc: 'Assemble multi-panel figures with live graphs and export PNG, SVG or print-ready PDF.', to: '/figures', tint: 'from-orange-50 to-amber-50 text-orange-600 ring-orange-100' },
  { icon: Search, title: 'Research navigator', desc: 'Look up public academic metadata from Crossref and Europe PMC, then save the record.', to: '/navigator', tint: 'from-pink-50 to-rose-50 text-pink-600 ring-pink-100' }
]

const tools = [
  { label: 'Graph Studio', to: '/graphs', icon: LineChart },
  { label: '3D Studio', to: '/three-d', icon: Layers },
  { label: 'Image Studio', to: '/images', icon: ImageIcon },
  { label: 'Vector Studio', to: '/vector', icon: FileImage },
  { label: 'Figure Composer', to: '/figures', icon: Grid2X2 },
  { label: 'Diagram Studio', to: '/diagrams', icon: Network },
  { label: 'Research Navigator', to: '/navigator', icon: Search },
  { label: 'Reference Manager', to: '/references', icon: BookOpen },
  { label: 'Writing Lab', to: '/writing', icon: FileText }
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

    {/* Contour rings beneath the surface add a lab-notebook feel. */}
    {[0, 1, 2].map((ring) => <ellipse key={ring} cx="260" cy={318 + ring * 12} rx={150 - ring * 28} ry={34 - ring * 7} fill="none" stroke="#93c5fd" strokeOpacity={0.4 - ring * 0.09} strokeDasharray="2 6" />)}
  </svg>
}

/* ------------------------------------------------------------------------ */

export default function Landing() {
  return <div className="relative isolate min-h-screen overflow-hidden bg-white text-slate-900">
    {/* Ambient light-theme atmosphere */}
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(191,219,254,.65),rgba(255,255,255,0))] blur-2xl" />
      <div className="absolute -right-40 top-40 h-[440px] w-[440px] rounded-full bg-[radial-gradient(closest-side,rgba(196,181,253,.45),rgba(255,255,255,0))] blur-2xl" />
      <div className="absolute -left-32 top-[560px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(165,243,252,.4),rgba(255,255,255,0))] blur-2xl" />
      <div className="grid-fade absolute inset-x-0 top-0 h-[640px]" />
    </div>

    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[74px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-[12.5px] font-semibold text-slate-500 lg:flex" aria-label="Landing navigation">
          <a href="#features" className="transition hover:text-slate-900">Features</a>
          <a href="#three-d" className="transition hover:text-slate-900">3D studio</a>
          <a href="#tools" className="transition hover:text-slate-900">Tools</a>
          <a href="#privacy" className="transition hover:text-slate-900">Privacy</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/home" className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[12.5px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,23,42,.7)] transition hover:bg-slate-800">
            Launch workspace <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </header>

    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-24 lg:pt-20">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-600 shadow-soft backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Local-first scientific workspace
          </div>

          <h1 className="mt-6 font-display text-[46px] font-extrabold leading-[1.02] tracking-[-0.045em] text-slate-900 sm:text-[62px] lg:text-[70px]">
            Research, made
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">beautifully simple.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-[1.75] text-slate-500">
            Explore data, build 2D and 3D scientific visuals, organise references and prepare publication-ready figures — all inside your browser, with no account and no data uploads.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/home" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 px-6 text-[13.5px] font-bold text-white shadow-[0_16px_34px_-14px_rgba(37,99,235,.75)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-14px_rgba(37,99,235,.8)]">
              Open SciVeyra <ArrowRight size={17} />
            </Link>
            <Link to="/three-d" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-6 text-[13.5px] font-bold text-slate-700 shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white">
              <Box size={16} className="text-indigo-500" /> Explore 3D studio
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11.5px] font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-500" /> Local-first storage</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles size={15} className="text-blue-500" /> No AI APIs</span>
            <span className="inline-flex items-center gap-1.5"><HardDrive size={15} className="text-violet-500" /> No account needed</span>
          </div>
        </div>

        {/* Hero visual: a light glass "3D lab" card */}
        <div className="relative mx-auto w-full max-w-[560px] animate-fade-up [animation-delay:120ms]">
          <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-blue-100/60 via-indigo-100/40 to-cyan-100/50 blur-2xl" />
          <div className="glass relative overflow-hidden rounded-[30px] p-3 shadow-[0_40px_90px_-40px_rgba(37,99,235,.45)]">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">3D surface · live</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 ring-1 ring-inset ring-emerald-100">WebGL</span>
            </div>

            <div className="relative mt-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/60">
              <SurfaceMesh className="h-auto w-full" />
              <div className="absolute left-4 top-4 flex flex-col gap-1">
                <span className="text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Z response</span>
                <span className="font-display text-[22px] font-extrabold tracking-tight text-slate-800">+ 42.7%</span>
                <span className="text-[9.5px] font-medium text-slate-400">synthetic preview</span>
              </div>
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between rounded-xl border border-white/70 bg-white/75 px-3 py-2 backdrop-blur">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><MousePointer2 size={12} className="text-blue-500" /> Drag to rotate</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><Palette size={12} className="text-violet-500" /> Viridis</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Interpolated surface', value: '128 × 96' },
                { label: 'Colour scale', value: 'Viridis' },
                { label: 'Export', value: 'PNG · PDF' }
              ].map((item) => <div key={item.label} className="rounded-xl border border-slate-200/70 bg-white/70 px-2.5 py-2">
                <div className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
                <div className="mt-0.5 text-[11px] font-extrabold text-slate-700">{item.value}</div>
              </div>)}
            </div>
          </div>

          <div className="absolute -left-4 top-[38%] hidden animate-floaty rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-lift backdrop-blur sm:block">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500"><span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Check size={12} /></span> Analysis complete</div>
          </div>
          <div className="absolute -right-3 bottom-16 hidden animate-floaty rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-lift backdrop-blur [animation-delay:1.4s] sm:block">
            <div className="text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Stored locally</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-bold text-slate-700"><ShieldCheck size={13} className="text-emerald-500" /> IndexedDB</div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/70 sm:grid-cols-4">
          {[
            { value: '9', label: 'Focused research tools' },
            { value: '100%', label: 'Browser-first workflow' },
            { value: '0', label: 'AI API keys required' },
            { value: '∞', label: 'Ideas to explore' }
          ].map((stat) => <div key={stat.label} className="bg-white px-5 py-6">
            <div className="font-display text-[26px] font-extrabold tracking-tight text-slate-900">{stat.value}</div>
            <div className="mt-1 text-[11px] font-medium text-slate-500">{stat.label}</div>
          </div>)}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-600">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400" /> Built for curious minds
          </div>
          <h2 className="mt-4 font-display text-[34px] font-extrabold leading-[1.1] tracking-[-0.035em] text-slate-900 sm:text-[42px]">Everything you need to<br className="hidden sm:block" /> make research move.</h2>
          <p className="mx-auto mt-4 max-w-lg text-[13.5px] leading-relaxed text-slate-500">Focused tools, a calm interface, and your work kept in your browser. No sign-up, no lock-in.</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => <Link key={feature.title} to={feature.to} className="group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lift">
            <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-inset ${feature.tint}`}><feature.icon size={20} /></div>
            <h3 className="mt-4 text-[14.5px] font-extrabold tracking-tight text-slate-900">{feature.title}</h3>
            <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-slate-500">{feature.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 opacity-0 transition group-hover:opacity-100">Open tool <ArrowRight size={13} /></span>
          </Link>)}
        </div>
      </section>

      {/* 3D showcase */}
      <section id="three-d" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/60 p-6 shadow-card sm:p-10 lg:p-12">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-to-br from-blue-200/50 to-violet-200/40 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/80 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                <Layers size={13} /> Interactive 3D
              </div>
              <h2 className="mt-4 font-display text-[32px] font-extrabold leading-[1.08] tracking-[-0.035em] text-slate-900 sm:text-[40px]">See your data in three dimensions.</h2>
              <p className="mt-4 max-w-lg text-[13.5px] leading-relaxed text-slate-500">Turn real XYZ measurements into surfaces, meshes and 3D scatter plots. Rotate, zoom and pan directly in the browser, then export a high-resolution PNG or PDF.</p>
              <ul className="mt-6 space-y-3">
                {['Surface, mesh and 3D scatter from real datasets', 'Viridis, Plasma, Ocean and Spectrum colour scales', 'Camera presets, marker sizing and axis titles', 'Raster export with clean white backgrounds'].map((item) => <li key={item} className="flex items-start gap-2.5 text-[12.5px] font-medium text-slate-600"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100"><Check size={11} /></span>{item}</li>)}
              </ul>
              <Link to="/three-d" className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-[12.5px] font-bold text-white shadow-[0_12px_28px_-12px_rgba(15,23,42,.7)] transition hover:-translate-y-0.5 hover:bg-slate-800">
                Open 3D Graph Studio <ArrowRight size={15} />
              </Link>
            </div>

            <div className="relative rounded-2xl border border-white/70 bg-white/70 p-3 shadow-card backdrop-blur">
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Surface · Viridis</span>
                <span className="text-[9.5px] font-semibold text-slate-400">drag · zoom · pan</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-blue-50/70">
                <SurfaceMesh className="h-auto w-full" />
              </div>
              <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                <span className="text-[10px] font-semibold text-slate-500">X · Y · Z</span>
                <span className="flex items-center gap-1">
                  {['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'].map((color) => <span key={color} className="h-3 w-3 rounded-full ring-1 ring-inset ring-black/5" style={{ backgroundColor: color }} />)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools */}
      <section id="tools" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-600">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400" /> Open the workspace
          </div>
          <h2 className="mt-4 font-display text-[34px] font-extrabold leading-[1.1] tracking-[-0.035em] text-slate-900 sm:text-[42px]">Nine focused tools.<br className="hidden sm:block" /> One clear flow.</h2>
        </div>
        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2.5">
          {tools.map((tool) => <Link key={tool.label} to={tool.to} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11.5px] font-bold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700">
            <tool.icon size={14} className="text-blue-500" />{tool.label}
          </Link>)}
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="flex flex-col items-start gap-5 rounded-[28px] border border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 via-white to-blue-50/50 p-6 shadow-soft sm:flex-row sm:items-center sm:p-8">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-emerald-600 shadow-soft ring-1 ring-inset ring-emerald-100"><ShieldCheck size={22} /></div>
          <div className="flex-1">
            <h3 className="font-display text-[18px] font-extrabold tracking-tight text-slate-900">Your research. Your browser. Your control.</h3>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-500">Projects, datasets, figures and references stay in local browser storage. Back up and restore everything as JSON. Online academic search is optional and contacts only the provider you choose.</p>
          </div>
          <Link to="/settings" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-[12px] font-bold text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-50">
            Privacy controls <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </main>

    <footer className="border-t border-slate-200/80 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
        <Logo />
        <p className="text-center text-[11px] text-slate-400 sm:text-left">Designed for discovery. Built for the browser.</p>
        <p className="text-[11px] text-slate-400">© SciVeyra · local-first research workspace</p>
      </div>
    </footer>
  </div>
}
