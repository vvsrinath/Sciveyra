import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Box, Info, Layers, Orbit, Palette, RefreshCw, Save, Trash2, Upload } from 'lucide-react'
import { Badge, Button, Callout, Card, Field, IconButton, Input, Modal, PageHeader, Select, Spinner, Toggle } from '../../components/ui'
import PlotlyChart from '../../components/PlotlyChart'
import { useApp } from '../../app/AppContext'
import { dbDelete, dbGetAll, dbPut } from '../../lib/storage.js'
import { numericColumns, parseSpreadsheetFile } from '../../lib/parse.js'
import { sampleSurfaceDataset } from '../../lib/sampleData.js'
import { buildPlotlyFigure, COLORSCALES, defaultConfig, normalizeConfig } from '../../lib/graphConfig.js'
import { exportPlotly } from '../../lib/export.js'
import { nowIso, slugify, uid } from '../../lib/util.js'
import type { Dataset, GraphConfig, GraphRecord } from '../../types'

type CameraKey = 'isometric' | 'top' | 'front' | 'side'

const CAMERAS: Record<CameraKey, { x: number; y: number; z: number }> = {
  isometric: { x: 1.35, y: 1.35, z: 1.05 },
  top: { x: 0.001, y: 0.001, z: 2.4 },
  front: { x: 0.001, y: 2.3, z: 0.55 },
  side: { x: 2.3, y: 0.001, z: 0.55 }
}

const cameraPresets: { id: CameraKey; label: string }[] = [
  { id: 'isometric', label: 'Isometric' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' }
]

const plotModes = [
  { id: 'surface', label: 'Surface', icon: Box },
  { id: 'mesh3d', label: 'Mesh', icon: Layers },
  { id: 'scatter3d', label: 'Scatter', icon: Orbit }
]

const modeLabel: Record<string, string> = { surface: 'Surface', mesh3d: 'Mesh', scatter3d: 'Scatter' }

export default function ThreeDStudio() {
  const { notify, markSaved } = useApp()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [config, setConfig] = useState<GraphConfig>(() => defaultConfig(null))
  const [camera, setCamera] = useState<CameraKey>('isometric')
  const [loading, setLoading] = useState(true)
  const [savedGraphs, setSavedGraphs] = useState<GraphRecord[]>([])
  const [plotly, setPlotly] = useState<{ Plotly: any; div: HTMLDivElement } | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')
  const [exporting, setExporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        let list = await dbGetAll('datasets') as Dataset[]
        const storedGraphs = await dbGetAll('graphs') as GraphRecord[]
        if (!list.some((dataset) => dataset.name.includes('surface grid'))) {
          const sample = sampleSurfaceDataset()
          await dbPut('datasets', sample)
          list = [...list, sample]
        }
        setDatasets(list)
        setSavedGraphs(storedGraphs
          .filter((graph) => graph.mode === '3d')
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
        const surface = list.find((dataset) => dataset.name.includes('surface grid')) || list[0]
        setDatasetId(surface.id)
        const numeric = numericColumns(surface)
        setConfig(normalizeConfig({
          ...defaultConfig(surface, { title: `${surface.name} — 3D surface` }),
          plotType: 'surface',
          xKey: numeric[0]?.key || '',
          yKeys: numeric[1] ? [numeric[1].key] : [],
          zKey: numeric[2]?.key || '',
          xLabel: numeric[0]?.name || 'X',
          yLabel: numeric[1]?.name || 'Y',
          zLabel: numeric[2]?.name || 'Z',
          colorscale: 'Viridis'
        }))
      } catch (error) {
        notify(error instanceof Error ? error.message : '3D Studio could not load datasets.', 'error')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dataset = datasets.find((item) => item.id === datasetId) || null
  const numeric = numericColumns(dataset)
  const figure = useMemo(() => buildPlotlyFigure(dataset, config, { dark: false }), [dataset, config])
  const plotLayout = useMemo(() => {
    const base = { ...figure.layout, autosize: true } as Record<string, any>
    if (base.scene) {
      base.scene = { ...base.scene, camera: { eye: CAMERAS[camera] }, dragmode: 'orbit' }
    }
    return base
  }, [figure.layout, camera])

  const axisSummary = useMemo(() => {
    if (!dataset) return []
    const keys = [config.xKey, config.yKeys[0], config.zKey].filter(Boolean)
    return keys.map((key) => {
      const column = dataset.columns.find((item) => item.key === key)
      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      let count = 0
      for (const row of dataset.rows) {
        const value = row[key]
        if (typeof value !== 'number' || Number.isNaN(value)) continue
        if (value < min) min = value
        if (value > max) max = value
        count += 1
      }
      return { key, name: column?.name || key, min: count ? min : null, max: count ? max : null }
    })
  }, [dataset, config.xKey, config.yKeys, config.zKey])

  const handlePlotReady = useCallback((Plotly: any, div: HTMLDivElement) => {
    setPlotly((current) => current?.Plotly === Plotly && current?.div === div ? current : { Plotly, div })
  }, [])
  const update = (patch: Partial<GraphConfig>) => setConfig((current) => normalizeConfig({ ...current, ...patch }))

  const changeDataset = (id: string) => {
    const next = datasets.find((item) => item.id === id)
    if (!next) return
    const cols = numericColumns(next)
    setDatasetId(id)
    setCamera('isometric')
    setConfig((current) => normalizeConfig({
      ...current,
      title: `${next.name} — 3D ${current.plotType.replace('3d', '')}`,
      xKey: cols[0]?.key || '',
      yKeys: cols[1] ? [cols[1].key] : [],
      zKey: cols[2]?.key || '',
      xLabel: cols[0]?.name || 'X',
      yLabel: cols[1]?.name || 'Y',
      zLabel: cols[2]?.name || 'Z'
    }))
  }

  const openSaved = (graph: GraphRecord) => {
    const target = datasets.find((item) => item.id === graph.datasetId)
    if (!target) {
      notify('The dataset for this saved 3D graph is missing. Re-import the data first.', 'error')
      return
    }
    setDatasetId(target.id)
    setCamera('isometric')
    setName(graph.name)
    setConfig(normalizeConfig({
      ...graph.config,
      plotType: ['surface', 'mesh3d', 'scatter3d'].includes(graph.config.plotType) ? graph.config.plotType : 'surface'
    }))
    notify(`Opened "${graph.name}".`, 'info')
  }

  const deleteSaved = async (id: string) => {
    if (!window.confirm('Delete this saved 3D graph? The dataset is not deleted.')) return
    await dbDelete('graphs', id)
    setSavedGraphs((current) => current.filter((graph) => graph.id !== id))
    notify('Saved 3D graph deleted.', 'info')
  }

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const { dataset: imported, warnings } = await parseSpreadsheetFile(file)
      await dbPut('datasets', imported)
      setDatasets((current) => [...current, imported])
      changeDataset(imported.id)
      notify(`Imported ${imported.rowCount} rows.${warnings.length ? ` ${warnings.length} note(s) apply.` : ''}`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Import failed.', 'error')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const save = async () => {
    if (!name.trim() || !dataset) return
    const record = {
      id: uid('graph'), name: name.trim(), datasetId: dataset.id, config,
      createdAt: nowIso(), updatedAt: nowIso(), mode: '3d' as const
    }
    await dbPut('graphs', record)
    setSavedGraphs((current) => [record, ...current.filter((graph) => graph.id !== record.id)])
    markSaved()
    setSaveOpen(false)
    notify('3D graph saved locally.', 'success')
  }

  const exportImage = async (format: 'png' | 'pdf') => {
    if (!plotly) { notify('Wait for the 3D scene to render.', 'warning'); return }
    setExporting(true)
    try {
      await exportPlotly(plotly.Plotly, plotly.div, format, `${slugify(name || config.title || '3d-graph')}.${format}`, {
        width: config.width, height: config.height, scale: 2, background: config.background
      })
      notify(`${format.toUpperCase()} exported. WebGL 3D scenes are rasterised; SVG export is not offered for 3D.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export failed.', 'error')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Spinner label="Opening 3D Graph Studio…" /></div>

  const scales = COLORSCALES as unknown as Record<string, [number, string][]>
  const activeScale = scales[config.colorscale] || scales.Viridis

  return <div className="space-y-4">
    <PageHeader eyebrow="Visual analysis / 03" title="3D Graph Studio" description="Render real XYZ data as interactive scatter, surface and mesh plots — rotate, zoom and export without leaving the browser."
      actions={<>
        <Button onClick={() => inputRef.current?.click()} icon={<Upload size={14} />}>Import data</Button>
        <Button variant="secondary" onClick={() => { setName(config.title); setSaveOpen(true) }} icon={<Save size={14} />}>Save</Button>
        <Button variant="primary" onClick={() => exportImage('pdf')} disabled={exporting} icon={<ArrowDownToLine size={14} />}>Export PDF</Button>
      </>}
    />
    <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm" hidden onChange={(event) => importFile(event.target.files?.[0])} aria-label="Import 3D dataset" />

    <div className="grid items-start gap-4 xl:grid-cols-[318px_minmax(0,1fr)]">
      <Card className="p-5 xl:sticky xl:top-20">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[13px] font-extrabold tracking-tight text-slate-800"><Box size={16} className="text-blue-500" /> Scene controls</h2>
          <Badge tone="slate">{modeLabel[config.plotType] || '3D'}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {plotModes.map((mode) => <button key={mode.id} type="button" onClick={() => update({ plotType: mode.id })}
            className={`flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-[10.5px] font-bold transition ${config.plotType === mode.id ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(147,197,253,.5)]' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
            <mode.icon size={16} />{mode.label}
          </button>)}
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Dataset">
            <Select value={datasetId} onChange={(event) => changeDataset(event.target.value)}>{datasets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="X column"><Select value={config.xKey} onChange={(event) => update({ xKey: event.target.value })}>{numeric.map((column) => <option key={column.key} value={column.key}>{column.name}</option>)}</Select></Field>
            <Field label="Y column"><Select value={config.yKeys[0] || ''} onChange={(event) => update({ yKeys: event.target.value ? [event.target.value] : [] })}>{numeric.map((column) => <option key={column.key} value={column.key}>{column.name}</option>)}</Select></Field>
            <Field label="Z column"><Select value={config.zKey} onChange={(event) => update({ zKey: event.target.value })}>{numeric.map((column) => <option key={column.key} value={column.key}>{column.name}</option>)}</Select></Field>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">Colour scale</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400"><Palette size={11} /> {config.colorscale}</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {Object.entries(scales).map(([scale, stops]) => <button key={scale} type="button" onClick={() => update({ colorscale: scale })}
                className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-[10.5px] font-bold transition ${config.colorscale === scale ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                <span className="flex h-4 w-16 overflow-hidden rounded-md ring-1 ring-inset ring-black/5">{stops.map(([, color], index) => <span key={index} className="flex-1" style={{ backgroundColor: color }} />)}</span>
                <span className="flex-1">{scale}</span>
                {config.colorscale === scale && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              </button>)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-1">
            <Toggle checked={!!config.showGrid} onChange={(value) => update({ showGrid: value })} label="Grid lines" hint="Show axis grids in the scene" />
            <Toggle checked={!!config.reverseColorscale} onChange={(value) => update({ reverseColorscale: value })} label="Reverse colours" hint="Flip the colour scale direction" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">Camera</span>
              <button type="button" onClick={() => setCamera('isometric')} className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline"><RefreshCw size={10} /> Reset</button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {cameraPresets.map((preset) => <button key={preset.id} type="button" onClick={() => setCamera(preset.id)}
                className={`rounded-lg border px-1 py-1.5 text-[10px] font-bold transition ${camera === preset.id ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>{preset.label}</button>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="X title"><Input value={config.xLabel} onChange={(event) => update({ xLabel: event.target.value })} /></Field>
            <Field label="Y title"><Input value={config.yLabel} onChange={(event) => update({ yLabel: event.target.value })} /></Field>
            <Field label="Z title"><Input value={config.zLabel || ''} onChange={(event) => update({ zLabel: event.target.value })} /></Field>
            <Field label="Marker size"><Input type="number" min={1} max={20} value={config.markerSize} onChange={(event) => update({ markerSize: Number(event.target.value) || 5 })} /></Field>
          </div>

          <Field label="Title"><Input value={config.title} onChange={(event) => update({ title: event.target.value })} /></Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">Saved 3D graphs</span>
              <span className="text-[10px] font-semibold text-slate-400">{savedGraphs.length}</span>
            </div>
            {savedGraphs.length ? <div className="space-y-1.5">{savedGraphs.map((graph) => <div key={graph.id} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
              <button type="button" onClick={() => openSaved(graph)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-[11px] font-bold text-slate-700">{graph.name}</div>
                <div className="text-[9.5px] text-slate-400">{modeLabel[graph.config.plotType] || '3D'} · {new Date(graph.updatedAt).toLocaleDateString()}</div>
              </button>
              <IconButton label={`Delete ${graph.name}`} onClick={() => deleteSaved(graph.id)} className="h-6 w-6 text-slate-400 hover:text-rose-600"><Trash2 size={12} /></IconButton>
            </div>)}</div> : <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-[10.5px] text-slate-400">Save a scene to reopen it here later.</p>}
          </div>

          {dataset?.source === 'sample' && <Callout tone="warning">This surface is generated from clearly labelled synthetic sample data.</Callout>}
          <Callout tone="info"><Info size={13} className="mr-1 inline" />Drag to rotate, scroll to zoom, right-drag to pan. Grids above ~250,000 cells may be slow.</Callout>

          <Button className="w-full" size="sm" variant="secondary" onClick={() => exportImage('png')} disabled={exporting} icon={<ArrowDownToLine size={12} />}>Export PNG preview</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone="green">Interactive 3D</Badge>
              <span className="text-[10px] font-semibold text-slate-400">WebGL via Plotly.js</span>
            </div>
            <h2 className="mt-1.5 truncate font-display text-[18px] font-extrabold tracking-tight text-slate-900">{config.title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[{ label: 'Rows', value: dataset?.rowCount.toLocaleString() || '0' }, { label: 'Columns', value: dataset?.columnCount || 0 }, { label: 'Mode', value: modeLabel[config.plotType] || config.plotType }, { label: 'Source', value: dataset?.source === 'sample' ? 'Synthetic' : 'Imported' }].map((chip) => <span key={chip.label} className="rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide text-slate-500">{chip.label} <span className="ml-1 text-slate-800">{chip.value}</span></span>)}
          </div>
        </div>

        <div className="relative bg-white p-3 sm:p-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/60 to-blue-50/50">
            <div className="h-[420px] w-full sm:h-[560px] xl:h-[640px]">
              <PlotlyChart data={figure.data} layout={plotLayout} onReady={handlePlotReady} className="h-full" ariaLabel="Interactive 3D scientific plot" />
            </div>
            <div className="pointer-events-none absolute right-3 top-3 hidden items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/80 px-2.5 py-1 text-[9.5px] font-bold text-slate-500 backdrop-blur sm:flex">
              <Orbit size={11} className="text-indigo-500" /> {cameraPresets.find((preset) => preset.id === camera)?.label}
            </div>
          </div>

          {!figure.data.length && <div className="mt-3"><Callout tone="warning">No 3D trace was generated. Choose numeric X, Y and Z columns with valid values.</Callout></div>}

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {axisSummary.map((axis) => <div key={axis.key} className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[10px] font-extrabold text-blue-600 shadow-[0_1px_2px_rgba(15,23,42,.06)]">{axis.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10.5px] font-bold text-slate-600">{axis.name}</div>
                <div className="text-[9.5px] text-slate-400">{axis.min === null ? 'No numeric values' : `${axis.min.toPrecision(4)} → ${axis.max?.toPrecision(4)}`}</div>
              </div>
            </div>)}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2">
            <span className="text-[10px] font-semibold text-slate-400">Colour mapping</span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-3 w-32 overflow-hidden rounded-full ring-1 ring-inset ring-black/5">{activeScale.map(([, color], index) => <span key={index} className="flex-1" style={{ backgroundColor: color }} />)}</span>
              <span className="text-[10px] font-bold text-slate-600">{config.colorscale}{config.reverseColorscale ? ' · reversed' : ''}</span>
            </span>
          </div>
        </div>
      </Card>
    </div>

    <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save 3D graph"
      footer={<><Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save locally</Button></>}>
      <Field label="Graph name"><Input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></Field>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Saved graphs appear in Project backups. Graph Studio can also reopen configurations with 3D plot types.</p>
    </Modal>
  </div>
}
