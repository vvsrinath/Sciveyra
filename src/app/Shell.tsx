import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpen, ChevronRight, FileImage, FileText, FolderOpen, Grid2X2, Home, Image as ImageIcon,
  Layers, LineChart, Menu, Network, Search, Settings, ShieldCheck, X
} from 'lucide-react'
import Logo from '../components/Logo'
import { ToastStack } from '../components/ui'
import { useApp } from './AppContext'

const groups: { title: string; items: { label: string; to: string; icon: typeof Home }[] }[] = [
  { title: 'Workspace', items: [{ label: 'Home', to: '/home', icon: Home }, { label: 'Projects', to: '/projects', icon: FolderOpen }] },
  { title: 'Data & graphs', items: [{ label: 'Graph Studio', to: '/graphs', icon: LineChart }, { label: '3D Graph Studio', to: '/three-d', icon: Layers }] },
  { title: 'Visual tools', items: [
    { label: 'Image Studio', to: '/images', icon: ImageIcon },
    { label: 'Vector Studio', to: '/vector', icon: FileImage },
    { label: 'Figure Composer', to: '/figures', icon: Grid2X2 },
    { label: 'Diagram Studio', to: '/diagrams', icon: Network }
  ] },
  { title: 'Research', items: [
    { label: 'Research Navigator', to: '/navigator', icon: Search },
    { label: 'Reference Manager', to: '/references', icon: BookOpen },
    { label: 'Writing Lab', to: '/writing', icon: FileText }
  ] }
]

const titles: Record<string, { title: string; section: string }> = {
  '/home': { title: 'Home', section: 'Workspace' },
  '/projects': { title: 'Projects', section: 'Workspace' },
  '/graphs': { title: 'Graph Studio', section: 'Data & graphs' },
  '/three-d': { title: '3D Graph Studio', section: 'Data & graphs' },
  '/images': { title: 'Image Studio', section: 'Visual tools' },
  '/vector': { title: 'Vector Studio', section: 'Visual tools' },
  '/figures': { title: 'Figure Composer', section: 'Visual tools' },
  '/diagrams': { title: 'Diagram Studio', section: 'Visual tools' },
  '/navigator': { title: 'Research Navigator', section: 'Research' },
  '/references': { title: 'Reference Manager', section: 'Research' },
  '/writing': { title: 'Writing Lab', section: 'Research' },
  '/settings': { title: 'Settings', section: 'Workspace' }
}

export default function Shell() {
  const { lastSavedAt, storageReady, storageError } = useApp()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const current = titles[location.pathname] || { title: 'Workspace', section: 'SciVeyra' }

  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  useEffect(() => { document.title = `SciVeyra — ${current.title}` }, [current.title])

  const savedLabel = useMemo(() => {
    if (!lastSavedAt) return 'Local-first'
    const seconds = Math.max(0, Math.round((Date.now() - new Date(lastSavedAt).getTime()) / 1000))
    if (seconds < 15) return 'Saved just now'
    if (seconds < 90) return 'Saved recently'
    return 'Saved locally'
  }, [lastSavedAt])

  const navLinkClass = (isActive: boolean) => `group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-all duration-150 ${
    isActive
      ? 'bg-blue-50/90 text-blue-700 shadow-[inset_0_0_0_1px_rgba(191,219,254,.75)]'
      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
  }`

  const sidebar = <div className="flex h-full flex-col px-3.5 pb-3.5 pt-5">
    <div className="flex items-center justify-between px-1 pb-6">
      <Logo to="/home" />
      <button type="button" className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
    </div>

    <nav className="flex-1 space-y-5 overflow-y-auto pb-4" aria-label="Workspace navigation">
      {groups.map((group) => <div key={group.title}>
        <div className="px-3 pb-2 text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-slate-400">{group.title}</div>
        <div className="space-y-0.5">
          {group.items.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => navLinkClass(isActive)}>
            {({ isActive }) => <>
              {isActive && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-600" />}
              <item.icon size={16} className={`shrink-0 transition ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </>}
          </NavLink>)}
        </div>
      </div>)}
    </nav>

    <div className="space-y-1 border-t border-slate-100 pt-3">
      <NavLink to="/settings" className={({ isActive }) => navLinkClass(isActive)}>
        {({ isActive }) => <>
          <Settings size={16} className={`shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
          <span>Settings</span>
        </>}
      </NavLink>

      <div className="mt-2 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-blue-50/60 p-3">
        <div className="flex items-center gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-lg ${storageError ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <ShieldCheck size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-bold text-slate-700">{storageError ? 'Storage fallback' : savedLabel}</div>
            <div className="truncate text-[9.5px] text-slate-400">{storageReady ? 'IndexedDB · private to this browser' : 'Preparing local storage…'}</div>
          </div>
          <span className={`h-1.5 w-1.5 rounded-full ${storageError ? 'bg-amber-400' : 'bg-emerald-400'}`} />
        </div>
      </div>
    </div>
  </div>

  return <div className="min-h-screen bg-white text-slate-800">
    {mobileOpen && <button type="button" className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}

    <aside className={`fixed inset-y-0 left-0 z-40 w-[262px] border-r border-slate-200/80 bg-white transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0 shadow-[0_0_60px_rgba(15,23,42,.15)]' : '-translate-x-full'}`}>{sidebar}</aside>

    <div className="min-w-0 lg:pl-[262px]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl md:px-7">
        <div className="flex min-w-0 items-center gap-2.5">
          <button type="button" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="hidden items-center gap-2 text-[11px] text-slate-400 sm:flex">
            <span className="font-medium">{current.section}</span>
            <ChevronRight size={12} className="text-slate-300" />
            <b className="font-bold text-slate-700">{current.title}</b>
          </div>
          <b className="truncate text-sm font-bold text-slate-700 sm:hidden">{current.title}</b>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-slate-500 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.18)]" /> Local workspace
          </span>
          <NavLink to="/settings" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600" aria-label="Open settings" title="Settings">
            <Settings size={16} />
          </NavLink>
        </div>
      </header>

      <main className="min-h-[calc(100vh-4rem)] bg-white bg-[radial-gradient(1100px_380px_at_50%_-160px,rgba(219,234,254,.5),rgba(255,255,255,0)_70%)]">
        <div className="mx-auto w-full max-w-[1560px] px-4 py-6 md:px-7 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
    <ToastStack />
  </div>
}
