import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine, ArrowUp, ArrowDown, Copy, Grid2X2, Image as ImageIcon, Layers,
  Plus, Redo2, Save, Trash2, Undo2, Upload
} from 'lucide-react'
import { Badge, Button, Callout, Card, Field, Input, Modal, PageHeader, Select, Spinner } from '../../components/ui'
import PlotlyChart from '../../components/PlotlyChart'
import { useApp } from '../../app/AppContext'
import { dbDelete, dbGetAll, dbPut } from '../../lib/storage.js'
import { buildPlotlyFigure } from '../../lib/graphConfig.js'
import {
  downloadBlob, downloadText, readFileAsDataURL, renderGraphToSvg, sanitizeSvg, svgDimensions,
  svgToPdf, svgToPngBlob
} from '../../lib/export.js'
import { nowIso, pluralize, slugify, uid } from '../../lib/util.js'
import type { Asset, Dataset, FigurePanel, FigureRecord, GraphRecord } from '../../types'

const DEFAULT_FIGURE = (): FigureRecord => ({
  id: uid('fig'),
  name: 'Untitled figure',
  width: 1200,
  height: 800,
  background: '#ffffff',
  panels: [],
  caption: '',
  createdAt: nowIso(),
  updatedAt: nowIso()
})

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

function escapeXml(value: string) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function figureToSvg(figure: FigureRecord, graphSvgMap: Record<string, string> = {}): string {
  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${figure.width}" height="${figure.height}" viewBox="0 0 ${figure.width} ${figure.height}">`)
  parts.push(`<rect width="${figure.width}" height="${figure.height}" fill="${escapeXml(figure.background || '#ffffff')}"/>`)
  for (const panel of figure.panels) {
    parts.push(`<g id="${escapeXml(panel.id)}">`)
    const x = Number(panel.x) || 0
    const y = Number(panel.y) || 0
    const w = Math.max(1, Number(panel.width) || 1)
    const h = Math.max(1, Number(panel.height) || 1)
    if (panel.kind === 'graph' && graphSvgMap[panel.id]) {
      try {
        const clean = sanitizeSvg(graphSvgMap[panel.id])
        const doc = new DOMParser().parseFromString(clean, 'image/svg+xml')
        const root = doc.documentElement
        root.setAttribute('x', String(x))
        root.setAttribute('y', String(y))
        root.setAttribute('width', String(w))
        root.setAttribute('height', String(h))
        root.setAttribute('preserveAspectRatio', 'xMidYMid meet')
        parts.push(new XMLSerializer().serializeToString(root))
      } catch {
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="#cbd5e1"/>`)
      }
    } else if (panel.kind === 'graph') {
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="#cbd5e1"/>`)
    } else if (panel.kind === 'svg' && panel.src) {
      try {
        const clean = sanitizeSvg(panel.src)
        const doc = new DOMParser().parseFromString(clean, 'image/svg+xml')
        const root = doc.documentElement
        root.setAttribute('x', String(x))
        root.setAttribute('y', String(y))
        root.setAttribute('width', String(w))
        root.setAttribute('height', String(h))
        root.setAttribute('preserveAspectRatio', 'xMidYMid meet')
        parts.push(new XMLSerializer().serializeToString(root))
      } catch {
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f1f5f9" stroke="#cbd5e1"/><text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" font-family="Arial" font-size="16" fill="#64748b">Invalid SVG panel</text>`)
      }
    } else if (panel.src) {
      const href = panel.src.startsWith('data:') ? panel.src : svgDataUrl(panel.src)
      parts.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(href)}"/>`)
    } else {
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f1f5f9" stroke="#cbd5e1" stroke-dasharray="6 4"/>`)
    }
    if (panel.label) {
      parts.push(`<text x="${x + 8}" y="${y + 26}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#111827">${escapeXml(panel.label)}</text>`)
    }
    if (panel.caption) {
      parts.push(`<text x="${x}" y="${y + h + 22}" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#475569">${escapeXml(panel.caption)}</text>`)
    }
    parts.push('</g>')
  }
  if (figure.caption) {
    parts.push(`<text x="24" y="${figure.height - 20}" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#475569">${escapeXml(figure.caption.slice(0, 300))}</text>`)
  }
  parts.push('</svg>')
  return parts.join('')
}

export default function FigureComposer() {
  const { notify, refreshToken, bumpRefresh, markSaved } = useApp()
  const [assets, setAssets] = useState<Asset[]>([])
  const [figures, setFigures] = useState<FigureRecord[]>([])
  const [graphs, setGraphs] = useState<GraphRecord[]>([])
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [graphPickerOpen, setGraphPickerOpen] = useState(false)
  const [liveError, setLiveError] = useState('')
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [figure, setFigure] = useState<FigureRecord>(DEFAULT_FIGURE)
  const [selected, setSelected] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<FigureRecord[]>([])
  const [redoStack, setRedoStack] = useState<FigureRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [assetOpen, setAssetOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [columns, setColumns] = useState('2')
  const [margin, setMargin] = useState('30')
  const [gap, setGap] = useState('20')
  const svgRef = useRef<SVGSVGElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; orig: FigurePanel } | null>(null)
  const figureRef = useRef(figure)
  figureRef.current = figure

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [assetList, figureList, graphList, datasetList] = await Promise.all([
          dbGetAll('assets') as Promise<Asset[]>,
          dbGetAll('figures') as Promise<FigureRecord[]>,
          dbGetAll('graphs') as Promise<GraphRecord[]>,
          dbGetAll('datasets') as Promise<Dataset[]>
        ])
        if (cancelled) return
        setAssets(assetList.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
        setFigures(figureList.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
        setGraphs(graphList.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
        setDatasets(datasetList)
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Figure projects could not be loaded.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const update = () => {
      const rect = svg.getBoundingClientRect()
      setCanvasSize({ width: rect.width, height: rect.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(svg)
    window.addEventListener('resize', update)
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [loading, figure.width, figure.height])

  const commit = (next: FigureRecord) => {
    setUndoStack((stack) => [...stack.slice(-29), figureRef.current])
    setRedoStack([])
    setFigure({ ...next, updatedAt: nowIso() })
    setDirty(true)
  }

  const update = (patch: Partial<FigureRecord>, history = true) => {
    const next = { ...figureRef.current, ...patch, updatedAt: nowIso() }
    if (history) commit(next)
    else setFigure(next)
  }

  const updatePanel = (id: string, patch: Partial<FigurePanel>, history = true) => {
    update({ panels: figureRef.current.panels.map((panel) => panel.id === id ? { ...panel, ...patch } : panel) }, history)
  }

  const undo = () => {
    if (!undoStack.length) return
    const previous = undoStack[undoStack.length - 1]
    setRedoStack((stack) => [...stack, figureRef.current])
    setUndoStack(undoStack.slice(0, -1))
    setFigure(previous)
    setDirty(true)
  }

  const redo = () => {
    if (!redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((stack) => [...stack, figureRef.current])
    setRedoStack(redoStack.slice(0, -1))
    setFigure(next)
    setDirty(true)
  }

  const addAsset = (asset: Asset) => {
    if (asset.kind === 'file') return
    let width = Math.min(figure.width * 0.45, 520)
    let height = Math.min(figure.height * 0.4, 360)
    if (asset.width && asset.height) {
      height = width * (asset.height / asset.width)
      if (height > figure.height * 0.42) { height = figure.height * 0.42; width = height * (asset.width / asset.height) }
    }
    const index = figure.panels.length
    const m = Number(margin) || 0
    const g = Number(gap) || 0
    const panel: FigurePanel = {
      id: uid('panel'),
      label: `(${String.fromCharCode(97 + (index % 26))})`,
      assetId: asset.id,
      src: asset.data,
      kind: asset.kind === 'svg' ? 'svg' : 'image',
      x: Math.round(m + (index % 2) * (width + g)),
      y: Math.round(m + Math.floor(index / 2) * (height + g + 30)),
      width: Math.round(width),
      height: Math.round(height)
    }
    update({ panels: [...figure.panels, panel] })
    setSelected(panel.id)
    setAssetOpen(false)
    notify(`Added "${asset.name}" to the figure.`, 'success')
  }

  const addLocalImage = async (file?: File) => {
    if (!file) return
    try {
      const src = await readFileAsDataURL(file)
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image()
        element.onload = () => resolve(element)
        element.onerror = () => reject(new Error('The image could not be decoded.'))
        element.src = src
      })
      const index = figure.panels.length
      const m = Number(margin) || 0
      const g = Number(gap) || 0
      let width = Math.min(figure.width * 0.45, 520)
      let height = width * (image.naturalHeight / image.naturalWidth)
      if (height > figure.height * 0.45) { height = figure.height * 0.45; width = height * (image.naturalWidth / image.naturalHeight) }
      const panel: FigurePanel = {
        id: uid('panel'), label: `(${String.fromCharCode(97 + (index % 26))})`, src, kind: 'image',
        x: Math.round(m + (index % 2) * (width + g)),
        y: Math.round(m + Math.floor(index / 2) * (height + g + 30)),
        width: Math.round(width), height: Math.round(height)
      }
      update({ panels: [...figure.panels, panel] })
      setSelected(panel.id)
      notify('Image panel added.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The image could not be added.', 'error')
    } finally {
      if (imageInput.current) imageInput.current.value = ''
    }
  }

  const addGraphPanel = (graph: GraphRecord) => {
    const dataset = datasets.find((item) => item.id === graph.datasetId)
    if (!dataset) {
      notify('The dataset for this saved graph is no longer available.', 'warning')
      return
    }
    const m = Number(margin) || 0
    const g = Number(gap) || 0
    let width = Math.min(figure.width * 0.45, 520)
    let height = width * ((graph.config.height || 560) / (graph.config.width || 900))
    if (height > figure.height * 0.42) { height = figure.height * 0.42; width = height * ((graph.config.width || 900) / (graph.config.height || 560)) }
    const index = figure.panels.length
    const panel: FigurePanel = {
      id: uid('panel'),
      label: `(${String.fromCharCode(97 + (index % 26))})`,
      kind: 'graph',
      graphId: graph.id,
      graphDatasetId: dataset.id,
      x: Math.round(m + (index % 2) * (width + g)),
      y: Math.round(m + Math.floor(index / 2) * (height + g + 30)),
      width: Math.round(width),
      height: Math.round(height)
    }
    update({ panels: [...figure.panels, panel] })
    setSelected(panel.id)
    setGraphPickerOpen(false)
    notify(`Live graph "${graph.name}" added. It re-renders from the saved graph on export.`, 'success')
  }

  const graphForPanel = (panel: FigurePanel) => panel.graphId ? graphs.find((item) => item.id === panel.graphId) || null : null

  const liveGraphFigure = (panel: FigurePanel) => {
    const graph = graphForPanel(panel)
    const dataset = datasets.find((item) => item.id === (panel.graphDatasetId || graph?.datasetId))
    if (!graph || !dataset) return null
    return buildPlotlyFigure(dataset, graph.config, { dark: false })
  }

  const deletePanel = (id: string) => {
    update({ panels: figure.panels.filter((panel) => panel.id !== id) })
    if (selected === id) setSelected(null)
  }

  const duplicatePanel = (id: string) => {
    const panel = figure.panels.find((item) => item.id === id)
    if (!panel) return
    const copy = { ...panel, id: uid('panel'), x: panel.x + 24, y: panel.y + 24, label: `(${String.fromCharCode(97 + (figure.panels.length % 26))})` }
    update({ panels: [...figure.panels, copy] })
    setSelected(copy.id)
  }

  const moveLayer = (id: string, direction: -1 | 1) => {
    const index = figure.panels.findIndex((panel) => panel.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= figure.panels.length) return
    const panels = [...figure.panels]
    ;[panels[index], panels[target]] = [panels[target], panels[index]]
    update({ panels })
  }

  const autoArrange = () => {
    if (!figure.panels.length) return
    const cols = Math.max(1, Math.min(6, Number(columns) || 2))
    const rows = Math.ceil(figure.panels.length / cols)
    const m = Math.max(0, Number(margin) || 0)
    const g = Math.max(0, Number(gap) || 0)
    const cellW = (figure.width - 2 * m - (cols - 1) * g) / cols
    const cellH = (figure.height - 2 * m - (rows - 1) * g - 30) / rows
    const panels = figure.panels.map((panel, index) => ({
      ...panel,
      x: Math.round(m + (index % cols) * (cellW + g)),
      y: Math.round(m + Math.floor(index / cols) * (cellH + g)),
      width: Math.round(cellW),
      height: Math.round(Math.max(40, cellH))
    }))
    update({ panels })
    notify('Panels arranged on an even grid.', 'success')
  }

  const align = (direction: 'left' | 'top') => {
    const selectedPanel = figure.panels.find((panel) => panel.id === selected)
    if (!selectedPanel) { notify('Select a panel to align others to it.', 'warning'); return }
    const panels = figure.panels.map((panel) => direction === 'left' ? { ...panel, x: selectedPanel.x } : { ...panel, y: selectedPanel.y })
    update({ panels })
  }

  const toFigurePoint = (event: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) / rect.width * figureRef.current.width,
      y: (event.clientY - rect.top) / rect.height * figureRef.current.height
    }
  }

  const startDrag = (event: React.PointerEvent, panel: FigurePanel, mode: 'move' | 'resize') => {
    event.preventDefault()
    event.stopPropagation()
    setSelected(panel.id)
    const point = toFigurePoint(event)
    dragRef.current = { id: panel.id, mode, startX: point.x, startY: point.y, orig: { ...panel } }
    setUndoStack((stack) => [...stack.slice(-29), figureRef.current])
    setRedoStack([])
    ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const point = toFigurePoint(event)
    const dx = point.x - drag.startX
    const dy = point.y - drag.startY
    if (drag.mode === 'move') {
      updatePanel(drag.id, {
        x: Math.round(Math.max(0, Math.min(figure.width - drag.orig.width, drag.orig.x + dx))),
        y: Math.round(Math.max(0, Math.min(figure.height - drag.orig.height, drag.orig.y + dy)))
      }, false)
    } else {
      updatePanel(drag.id, {
        width: Math.round(Math.max(40, Math.min(figure.width - drag.orig.x, drag.orig.width + dx))),
        height: Math.round(Math.max(40, Math.min(figure.height - drag.orig.y, drag.orig.height + dy)))
      }, false)
    }
    setDirty(true)
  }

  const endDrag = () => { dragRef.current = null }

  const saveFigure = async () => {
    const name = (saveName || figure.name || 'Untitled figure').trim()
    try {
      const record = { ...figureRef.current, name, updatedAt: nowIso() }
      await dbPut('figures', record)
      setFigures((current) => [record, ...current.filter((item) => item.id !== record.id)])
      setFigure(record)
      setDirty(false)
      setSaveOpen(false)
      setSaveName('')
      markSaved()
      bumpRefresh()
      notify(`Figure "${name}" saved locally.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The figure could not be saved.', 'error')
    }
  }

  const openFigure = (record: FigureRecord) => {
    setFigure(record)
    setUndoStack([])
    setRedoStack([])
    setSelected(null)
    setDirty(false)
    notify(`Opened "${record.name}".`, 'info')
  }

  const newFigure = () => {
    if (dirty && !window.confirm('Discard unsaved changes and create a new figure?')) return
    const next = DEFAULT_FIGURE()
    setFigure(next)
    setUndoStack([])
    setRedoStack([])
    setSelected(null)
    setDirty(false)
  }

  const deleteFigure = async (id: string) => {
    if (!window.confirm('Delete this saved figure? Assets are not deleted.')) return
    await dbDelete('figures', id)
    setFigures((current) => current.filter((item) => item.id !== id))
    if (figure.id === id) newFigure()
    bumpRefresh()
    notify('Figure deleted.', 'info')
  }

  const snapshotGraphs = async (record: FigureRecord) => {
    const map: Record<string, string> = {}
    const failures: string[] = []
    for (const panel of record.panels) {
      if (panel.kind !== 'graph') continue
      const figureData = liveGraphFigure(panel)
      if (!figureData) { failures.push(panel.label || 'graph panel'); continue }
      try {
        map[panel.id] = await renderGraphToSvg({ data: figureData.data, layout: figureData.layout }, {
          width: panel.width,
          height: panel.height,
          background: record.background || '#ffffff'
        })
      } catch {
        failures.push(panel.label || 'graph panel')
      }
    }
    if (failures.length) setLiveError(`Snapshot skipped for ${failures.join(', ')}; the placeholder box was kept.`)
    return map
  }

  const exportFigure = async (format: 'svg' | 'png' | 'pdf') => {
    if (!figure.panels.length) { notify('Add at least one panel before exporting.', 'warning'); return }
    setExporting(true)
    setLiveError('')
    try {
      const graphSvgMap = await snapshotGraphs(figureRef.current)
      const svg = figureToSvg(figureRef.current, graphSvgMap)
      const clean = sanitizeSvg(svg)
      const base = slugify(figure.name || 'figure')
      if (format === 'svg') {
        downloadText(clean, `${base}.svg`, 'image/svg+xml;charset=utf-8')
      } else if (format === 'png') {
        const blob = await svgToPngBlob(clean, { width: figure.width, height: figure.height, scale: 2, background: figure.background })
        downloadBlob(blob, `${base}.png`)
      } else {
        await svgToPdf(clean, `${base}.pdf`, { width: figure.width, height: figure.height, scale: 2, background: figure.background })
      }
      notify(`${format.toUpperCase()} exported with ${figure.panels.length} composed panel(s).`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export failed.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const selectedPanel = figure.panels.find((panel) => panel.id === selected) || null
  const previewSvg = useMemo(() => figureToSvg(figure), [figure])

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Spinner label="Opening Figure Composer…" /></div>

  return <div>
    <PageHeader eyebrow="PUBLICATION TOOLS / 01" title="Figure Composer" description="Arrange images, graph exports and vector assets into a real multi-panel figure."
      actions={<>
        <Button variant="secondary" onClick={newFigure} icon={<Plus size={14} />}>New</Button>
        <Button variant="secondary" onClick={() => { setSaveName(figure.name); setSaveOpen(true) }} icon={<Save size={14} />}>Save</Button>
        <Button variant="primary" onClick={() => exportFigure('png')} disabled={exporting || !figure.panels.length} icon={<ArrowDownToLine size={14} />}>{exporting ? 'Exporting…' : 'Export PNG'}</Button>
      </>}
    />
    <input ref={imageInput} type="file" accept="image/*" hidden onChange={(event) => addLocalImage(event.target.files?.[0])} aria-label="Add image panel" />

    <div className="grid items-start gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <Card className="p-3.5">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-700 dark:text-slate-200"><Grid2X2 size={14} className="text-blue-500" />Figure</h2>
          <Field label="Figure name"><Input value={figure.name} onChange={(event) => update({ name: event.target.value }, false)} /></Field>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Width (px)"><Input type="number" min={200} max={6000} value={figure.width} onChange={(event) => update({ width: Math.max(200, Number(event.target.value) || 1200) })} /></Field>
            <Field label="Height (px)"><Input type="number" min={200} max={6000} value={figure.height} onChange={(event) => update({ height: Math.max(200, Number(event.target.value) || 800) })} /></Field>
          </div>
          <Field label="Background" className="mt-2"><input type="color" value={figure.background} onChange={(event) => update({ background: event.target.value })} aria-label="Figure background color" className="h-9 w-full rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></Field>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Button size="sm" onClick={() => setAssetOpen(true)} icon={<Plus size={12} />}>Add asset</Button>
            <Button size="sm" variant="secondary" onClick={() => imageInput.current?.click()} icon={<Upload size={12} />}>Add image</Button>
            <Button size="sm" variant="secondary" className="col-span-2" onClick={() => setGraphPickerOpen(true)} icon={<Layers size={12} />}>Add live graph ({graphs.length})</Button>
            <Button size="sm" variant="ghost" onClick={undo} disabled={!undoStack.length} icon={<Undo2 size={12} />}>Undo</Button>
            <Button size="sm" variant="ghost" onClick={redo} disabled={!redoStack.length} icon={<Redo2 size={12} />}>Redo</Button>
          </div>
        </Card>

        <Card className="p-3.5">
          <h2 className="mb-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">Layout</h2>
          <div className="grid grid-cols-3 gap-1.5">
            <Field label="Cols"><Input type="number" min={1} max={6} value={columns} onChange={(event) => setColumns(event.target.value)} /></Field>
            <Field label="Margin"><Input type="number" min={0} value={margin} onChange={(event) => setMargin(event.target.value)} /></Field>
            <Field label="Gap"><Input type="number" min={0} value={gap} onChange={(event) => setGap(event.target.value)} /></Field>
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={autoArrange} icon={<Grid2X2 size={12} />}>Auto-arrange grid</Button>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => align('left')}>Align left</Button>
            <Button size="sm" variant="ghost" onClick={() => align('top')}>Align top</Button>
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Panels ({figure.panels.length})</h2><Badge tone="slate">click to select</Badge></div>
          <div className="max-h-44 space-y-1 overflow-auto">
            {figure.panels.map((panel) => <button key={panel.id} type="button" onClick={() => setSelected(panel.id)}
              className={`flex w-full items-center gap-2 rounded-md border p-1.5 text-left text-[10px] ${selected === panel.id ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40' : 'border-slate-100 dark:border-slate-800'}`}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-white font-bold text-blue-600 dark:bg-slate-800 dark:text-blue-300">{panel.label || '–'}</span>
              <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{assets.find((asset) => asset.id === panel.assetId)?.name || panel.caption || 'Panel'}</span>
            </button>)}
            {!figure.panels.length && <p className="text-[10px] text-slate-400">Add a graph from Graph Studio, a trace, or a local image.</p>}
          </div>
        </Card>

        {selectedPanel && <Card className="p-3.5">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Selected panel</h2>
            <div className="flex gap-1">
              <button type="button" aria-label="Move panel backward" onClick={() => moveLayer(selectedPanel.id, -1)} className="text-slate-400 hover:text-blue-500"><ArrowDown size={13} /></button>
              <button type="button" aria-label="Move panel forward" onClick={() => moveLayer(selectedPanel.id, 1)} className="text-slate-400 hover:text-blue-500"><ArrowUp size={13} /></button>
              <button type="button" aria-label="Duplicate panel" onClick={() => duplicatePanel(selectedPanel.id)} className="text-slate-400 hover:text-blue-500"><Copy size={13} /></button>
              <button type="button" aria-label="Delete panel" onClick={() => deletePanel(selectedPanel.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          </div>
          <Field label="Label"><Input value={selectedPanel.label} onChange={(event) => updatePanel(selectedPanel.id, { label: event.target.value }, false)} /></Field>
          <Field label="Caption" className="mt-2"><Input value={selectedPanel.caption || ''} onChange={(event) => updatePanel(selectedPanel.id, { caption: event.target.value }, false)} placeholder="Optional short caption" /></Field>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {(['x', 'y', 'width', 'height'] as const).map((field) => <Field key={field} label={field}>
              <Input type="number" value={Math.round(selectedPanel[field])} onChange={(event) => updatePanel(selectedPanel.id, { [field]: Number(event.target.value) || 0 })} />
            </Field>)}
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Drag panels on the canvas to move. Drag the corner handle to resize. Embedded SVG is sanitised and aspect ratio is preserved inside its box.</p>
        </Card>}
      </aside>

      <div className="min-w-0 space-y-3">
        <Card className="p-3.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div><Badge tone="green">FIGURE CANVAS</Badge><p className="mt-1 text-[10px] text-slate-500">{figure.width}×{figure.height} px · {pluralize(figure.panels.length, 'panel')} · {dirty ? 'unsaved changes' : 'saved state'}</p></div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => exportFigure('svg')}>SVG</Button>
              <Button size="sm" variant="secondary" onClick={() => exportFigure('pdf')}>PDF</Button>
              <Button size="sm" variant="primary" onClick={() => exportFigure('png')}>PNG</Button>
            </div>
          </div>
          <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-950">
            <div className="relative mx-auto" style={{ width: '100%', maxWidth: '100%' }} onClick={() => setSelected(null)}>
            <svg
              ref={svgRef}
              width="100%"
              style={{ maxHeight: '68vh', aspectRatio: `${figure.width} / ${figure.height}` }}
              viewBox={`0 0 ${figure.width} ${figure.height}`}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
              className="mx-auto block select-none rounded bg-white shadow-sm"
              role="img"
              aria-label="Composed figure canvas"
            >
              <rect width={figure.width} height={figure.height} fill={figure.background} />
              {figure.panels.map((panel) => <g key={panel.id} onPointerDown={(event) => startDrag(event, panel, 'move')} className="cursor-move">
                {panel.src ? <image href={panel.kind === 'svg' ? svgDataUrl(panel.src) : panel.src} x={panel.x} y={panel.y} width={panel.width} height={panel.height} preserveAspectRatio="xMidYMid meet" /> : <rect x={panel.x} y={panel.y} width={panel.width} height={panel.height} fill="#f1f5f9" stroke="#cbd5e1" strokeDasharray="6 4" />}
                {panel.label && <text x={panel.x + 8} y={panel.y + 26} fontSize={24} fontWeight={700} fill="#111827">{panel.label}</text>}
                {panel.caption && <text x={panel.x} y={panel.y + panel.height + 22} fontSize={16} fill="#475569">{panel.caption}</text>}
                {selected === panel.id && <>
                  <rect x={panel.x} y={panel.y} width={panel.width} height={panel.height} fill="none" stroke="#3779f6" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />
                  <rect x={panel.x + panel.width - 12} y={panel.y + panel.height - 12} width={16} height={16} fill="#3779f6" stroke="#fff" strokeWidth={2} className="cursor-nwse-resize" onPointerDown={(event) => startDrag(event, panel, 'resize')} />
                </>}
              </g>)}
              {!figure.panels.length && <text x={figure.width / 2} y={figure.height / 2} textAnchor="middle" fontSize={20} fill="#94a3b8">Add graph exports or images to build a figure</text>}
            </svg>
            {canvasSize.width > 0 && figure.panels.filter((panel) => panel.kind === 'graph').map((panel) => {
              const scale = canvasSize.width / figure.width
              const live = liveGraphFigure(panel)
              return <div key={panel.id} className="pointer-events-none absolute overflow-hidden rounded" style={{ left: panel.x * scale, top: panel.y * scale, width: panel.width * scale, height: panel.height * scale }}>
                {live ? <PlotlyChart data={live.data} layout={{ ...live.layout, width: undefined, height: undefined, autosize: true, margin: { l: 48, r: 16, t: 28, b: 40 } }} className="!min-h-0 h-full" ariaLabel={`Live graph panel ${panel.label}`} /> : <div className="grid h-full w-full place-items-center bg-slate-50 text-[10px] text-slate-400">Graph unavailable</div>}
              </div>
            })}
            </div>
          </div>
          {figure.panels.some((panel) => panel.kind === 'graph') && <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">Live graph panels re-render from their saved datasets and are snapshotted to vector SVG on export.</p>}
          {liveError && <Callout tone="warning">{liveError}</Callout>}
        </Card>

        <Card className="p-3.5">
          <Field label="Figure caption / notes"><textarea value={figure.caption} onChange={(event) => update({ caption: event.target.value }, false)} rows={3} className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="Describe the figure. Do not invent experimental details." /></Field>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between"><h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Saved figures</h2><Layers size={14} className="text-slate-400" /></div>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {figures.map((record) => <div key={record.id} className="flex items-center gap-1 rounded-md border border-slate-100 p-1.5 dark:border-slate-800">
              <button type="button" onClick={() => openFigure(record)} className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-300">{record.name}</button>
              <span className="text-[9px] text-slate-400">{record.panels?.length || 0}p</span>
              <button type="button" aria-label={`Delete figure ${record.name}`} onClick={() => deleteFigure(record.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
            </div>)}
            {!figures.length && <p className="text-[10px] text-slate-400">No saved figures yet.</p>}
          </div>
        </Card>
      </div>
    </div>

    <Modal open={assetOpen} onClose={() => setAssetOpen(false)} title="Add an asset panel" wide>
      {assets.filter((asset) => asset.kind !== 'file').length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {assets.filter((asset) => asset.kind !== 'file').map((asset) => <button key={asset.id} type="button" onClick={() => addAsset(asset)} className="rounded-lg border border-slate-200 p-2 text-left hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:hover:bg-slate-800">
          <div className="grid h-24 place-items-center overflow-hidden rounded bg-slate-50 dark:bg-slate-900">
            <img src={asset.kind === 'svg' ? svgDataUrl(asset.data) : asset.data} alt="" className="max-h-24 max-w-full object-contain" />
          </div>
          <div className="mt-1 truncate text-[10px] font-bold text-slate-700 dark:text-slate-200">{asset.name}</div>
          <div className="text-[9px] text-slate-400">{asset.kind.toUpperCase()} asset</div>
        </button>)}
      </div> : <Callout tone="info">No assets yet. Export a graph with “Send to Figure Composer”, save a trace from Vector Studio, or use “Add image”.</Callout>}
    </Modal>

    <Modal open={graphPickerOpen} onClose={() => setGraphPickerOpen(false)} title="Add a live graph panel" wide>
      {graphs.length ? <div className="grid gap-2 sm:grid-cols-2">
        {graphs.map((graph) => {
          const dataset = datasets.find((item) => item.id === graph.datasetId)
          return <button key={graph.id} type="button" onClick={() => addGraphPanel(graph)} disabled={!dataset} className="rounded-lg border border-slate-200 p-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-300"><Layers size={13} /></span>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">{graph.name}</div>
                <div className="truncate text-[9px] text-slate-400">{dataset ? `${dataset.name} · ${graph.config.plotType}` : 'Dataset missing'}</div>
              </div>
            </div>
          </button>
        })}
      </div> : <Callout tone="info">No saved graphs yet. Build a chart in Graph Studio and save it, then reopen this dialog to embed it as a live panel.</Callout>}
      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">Live panels stay linked to their saved graph and dataset. They render interactively on the canvas and are snapshotted to vector SVG when you export.</p>
    </Modal>

    <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save figure"
      footer={<><Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button><Button variant="primary" onClick={saveFigure}>Save locally</Button></>}>
      <Field label="Figure name"><Input value={saveName} onChange={(event) => setSaveName(event.target.value)} autoFocus /></Field>
      <p className="mt-2 text-[10px] text-slate-500">Saved figure projects can be reopened here. Back up local data from Settings.</p>
    </Modal>
  </div>
}
