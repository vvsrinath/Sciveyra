import { useCallback, useEffect, useRef, useState } from 'react'

export type PwaRegistrationState = 'unsupported' | 'inactive' | 'active' | 'error'

export type PwaStatus = {
  isOnline: boolean
  isOffline: boolean
  isInstallable: boolean
  updateAvailable: boolean
  registrationState: PwaRegistrationState
  install: () => Promise<void>
  applyUpdate: () => void
}

/** `beforeinstallprompt` is not in the TS DOM lib, so describe the part we use. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>
}

function hasServiceWorkerSupport(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return typeof (event as BeforeInstallPromptEvent).prompt === 'function'
}

/**
 * Observes browser connectivity, install eligibility and service worker updates.
 * Registration itself happens once in main.tsx; this hook only reports state and
 * exposes the two user actions (install / apply update).
 */
export function usePwaStatus(): PwaStatus {
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  ))
  const [isInstallable, setIsInstallable] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registrationState, setRegistrationState] = useState<PwaRegistrationState>(() => (
    hasServiceWorkerSupport() ? 'inactive' : 'unsupported'
  ))

  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)
  const waitingWorker = useRef<ServiceWorker | null>(null)
  const reloadAfterUpdate = useRef(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) return
      event.preventDefault()
      deferredPrompt.current = event
      setIsInstallable(true)
    }
    const handleAppInstalled = () => {
      deferredPrompt.current = null
      setIsInstallable(false)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      deferredPrompt.current = null
    }
  }, [])

  useEffect(() => {
    if (!hasServiceWorkerSupport()) return
    const serviceWorker = navigator.serviceWorker
    let cancelled = false
    let observed: ServiceWorkerRegistration | null = null
    const workerCleanups = new Map<ServiceWorker, () => void>()

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker || workerCleanups.has(worker)) return
      const handleStateChange = () => {
        if (cancelled) return
        if (worker.state === 'installed' && serviceWorker.controller) {
          waitingWorker.current = worker
          setUpdateAvailable(true)
        } else if (worker.state === 'activated') {
          waitingWorker.current = null
          setUpdateAvailable(false)
        }
      }
      worker.addEventListener('statechange', handleStateChange)
      workerCleanups.set(worker, () => worker.removeEventListener('statechange', handleStateChange))
      handleStateChange()
    }

    const handleUpdateFound = () => {
      if (observed) watchWorker(observed.installing)
    }

    const observe = (registration: ServiceWorkerRegistration) => {
      if (cancelled || observed === registration) return
      if (observed) observed.removeEventListener('updatefound', handleUpdateFound)
      observed = registration
      registration.addEventListener('updatefound', handleUpdateFound)
      setRegistrationState(registration.active ? 'active' : 'inactive')
      watchWorker(registration.installing)
      watchWorker(registration.waiting)
    }

    const handleControllerChange = () => {
      if (cancelled) return
      waitingWorker.current = null
      setUpdateAvailable(false)
      setRegistrationState('active')
      if (reloadAfterUpdate.current) {
        reloadAfterUpdate.current = false
        window.location.reload()
      }
    }

    serviceWorker.addEventListener('controllerchange', handleControllerChange)
    serviceWorker.ready.then(observe).catch(() => {
      if (!cancelled) setRegistrationState('error')
    })
    serviceWorker.getRegistration().then((existing) => {
      if (existing) observe(existing)
    }).catch(() => {
      if (!cancelled) setRegistrationState('error')
    })

    return () => {
      cancelled = true
      serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      if (observed) observed.removeEventListener('updatefound', handleUpdateFound)
      for (const cleanup of workerCleanups.values()) cleanup()
      workerCleanups.clear()
      waitingWorker.current = null
    }
  }, [])

  const install = useCallback(async () => {
    const promptEvent = deferredPrompt.current
    if (!promptEvent) return
    // A deferred prompt can only be used once, regardless of the user's choice.
    deferredPrompt.current = null
    setIsInstallable(false)
    try {
      await promptEvent.prompt()
      await promptEvent.userChoice.catch(() => null)
    } catch {
      // The user may cancel the install flow; nothing else to do.
    }
  }, [])

  const applyUpdate = useCallback(() => {
    const worker = waitingWorker.current
    if (!worker) return
    reloadAfterUpdate.current = true
    try {
      worker.postMessage({ type: 'SKIP_WAITING' })
    } catch {
      reloadAfterUpdate.current = false
    }
  }, [])

  return {
    isOnline,
    isOffline: !isOnline,
    isInstallable,
    updateAvailable,
    registrationState,
    install,
    applyUpdate
  }
}
