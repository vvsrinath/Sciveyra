import { useEffect, useRef, useState } from 'react'
import { useApp } from './AppContext'

type AutosaveOptions<T> = {
  /** Debounce in milliseconds. */
  delay?: number
  /** Set false while a record is loading or the editor is inactive. */
  enabled?: boolean
  /** Optional stable serialization for large or non-JSON values. */
  serialize?: (value: T) => string
  onSave: (value: T) => void | Promise<void>
}

/**
 * Debounced local autosave with shared status reporting. The callback only runs
 * after a real value change, and late responses from stale values are ignored.
 */
export function useAutosave<T>(value: T, options: AutosaveOptions<T>) {
  const { storageReady, markSaved, setSaveStatus } = useApp()
  const { delay = 900, enabled = true, serialize, onSave } = options
  const latestValue = useRef(value)
  const saveRef = useRef(onSave)
  const serialized = serialize ? serialize(value) : JSON.stringify(value)
  const lastHandled = useRef<string | null>(null)
  const latestSerialized = useRef(serialized)
  const mounted = useRef(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    latestValue.current = value
    latestSerialized.current = serialized
    saveRef.current = onSave
  })

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (lastHandled.current === null) {
      lastHandled.current = serialized
      setPending(false)
      return
    }
    if (!enabled || !storageReady || serialized === lastHandled.current) return
    setPending(true)
    setSaveStatus('saving')
    const token = serialized
    const timer = setTimeout(async () => {
      try {
        await saveRef.current(latestValue.current)
        if (!mounted.current || token !== latestSerialized.current) return
        lastHandled.current = token
        setPending(false)
        markSaved()
        setSaveStatus('saved')
      } catch {
        if (mounted.current) setSaveStatus('error')
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [serialized, delay, enabled, storageReady, markSaved, setSaveStatus])

  return { pending }
}
