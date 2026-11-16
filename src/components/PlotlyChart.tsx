import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

type Props = {
  data: unknown[]
  layout: Record<string, unknown>
  config?: Record<string, unknown>
  className?: string
  ariaLabel?: string
  onReady?: (Plotly: any, div: HTMLDivElement) => void
}

let plotlyPromise: Promise<any> | null = null

function loadPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js-dist-min').then((module) => module.default || module)
  }
  return plotlyPromise
}

export default function PlotlyChart({ data, layout, config = {}, className = '', ariaLabel = 'Scientific chart', onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotlyRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const readyRef = useRef(onReady)
  readyRef.current = onReady

  useEffect(() => {
    let cancelled = false
    const div = containerRef.current
    if (!div) return
    setLoading(true)
    setError('')
    loadPlotly().then(async (Plotly) => {
      if (cancelled || !containerRef.current) return
      plotlyRef.current = Plotly
      const mergedConfig = {
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
        toImageButtonOptions: { format: 'png', filename: 'sciveyra-chart', scale: 2 },
        ...config
      }
      try {
        await Plotly.react(containerRef.current, data, layout, mergedConfig)
        if (!cancelled) {
          setLoading(false)
          readyRef.current?.(Plotly, containerRef.current as HTMLDivElement)
        }
      } catch (plotError) {
        if (!cancelled) {
          setLoading(false)
          setError(plotError instanceof Error ? plotError.message : 'The chart could not be rendered.')
        }
      }
    }).catch((loadError) => {
      if (!cancelled) {
        setLoading(false)
        setError(loadError instanceof Error ? loadError.message : 'The charting library could not be loaded.')
      }
    })

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && div) {
      let frame = 0
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          if (plotlyRef.current && containerRef.current) {
            try { plotlyRef.current.Plots.resize(containerRef.current) } catch { /* ignore */ }
          }
        })
      })
      observer.observe(div)
    }

    return () => {
      cancelled = true
      observer?.disconnect()
      if (containerRef.current && plotlyRef.current) {
        try { plotlyRef.current.purge(containerRef.current) } catch { /* ignore */ }
      }
    }
    // data and layout are memoized by callers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layout])

  return <div className={`relative min-h-[260px] w-full ${className}`} aria-busy={loading}>
    <div ref={containerRef} className="h-full w-full" role="img" aria-label={ariaLabel} />
    {loading && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/60 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
      <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Rendering chart…</span>
    </div>}
    {error && <div className="absolute inset-0 grid place-items-center p-6 text-center">
      <div>
        <p className="text-xs font-bold text-red-600">Chart rendering failed</p>
        <p className="mt-1 max-w-sm text-[11px] text-slate-500">{error}</p>
      </div>
    </div>}
  </div>
}
