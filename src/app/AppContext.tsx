import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { migrateLegacyData } from '../lib/storage.js'

type ToastTone = 'success' | 'error' | 'info' | 'warning'
export type Toast = { id: string; message: string; tone: ToastTone }
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type AppContextValue = {
  /** SciVeyra ships a single, calm light theme. Kept for API compatibility. */
  theme: 'light'
  setTheme: (_theme: 'light' | 'dark') => void
  toggleTheme: () => void
  toasts: Toast[]
  notify: (message: string, tone?: ToastTone) => void
  dismissToast: (id: string) => void
  storageReady: boolean
  storageError: string
  refreshToken: number
  bumpRefresh: () => void
  lastSavedAt: string | null
  markSaved: () => void
  saveStatus: SaveStatus
  setSaveStatus: (status: SaveStatus) => void
}

const AppContext = createContext<AppContextValue | null>(null)

/** The workspace is intentionally light-only: no dark class is ever applied. */
function enforceLightTheme() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('dark')
  root.style.colorScheme = 'light'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setToasts((current) => [...current.slice(-3), { id, message, tone }])
    const timer = setTimeout(() => dismissToast(id), tone === 'error' ? 9000 : 5000)
    timers.current.set(id, timer)
  }, [dismissToast])

  // Light-only: these remain no-ops so older callers keep working.
  const setTheme = useCallback(() => { enforceLightTheme() }, [])
  const toggleTheme = useCallback(() => { enforceLightTheme() }, [])

  const bumpRefresh = useCallback(() => setRefreshToken((value) => value + 1), [])
  const markSaved = useCallback(() => setLastSavedAt(new Date().toISOString()), [])

  useEffect(() => {
    enforceLightTheme()
    try { localStorage.setItem('sciveyra-theme', 'light') } catch { /* private mode */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await migrateLegacyData()
        if (!cancelled) setStorageReady(true)
      } catch (error) {
        if (!cancelled) {
          setStorageError(error instanceof Error ? error.message : 'Local storage could not be opened.')
          setStorageReady(true)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer)
  }, [])

  const value = useMemo(() => ({
    theme: 'light' as const,
    setTheme,
    toggleTheme,
    toasts,
    notify,
    dismissToast,
    storageReady,
    storageError,
    refreshToken,
    bumpRefresh,
    lastSavedAt,
    markSaved,
    saveStatus,
    setSaveStatus
  }), [setTheme, toggleTheme, toasts, notify, dismissToast, storageReady, storageError, refreshToken, bumpRefresh, lastSavedAt, markSaved, saveStatus])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
