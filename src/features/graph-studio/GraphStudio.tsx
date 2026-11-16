import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowDownToLine, Check, Database, FileJson, FileText, Grid2X2,
  Image as ImageIcon, Plus, Save, Upload, WandSparkles
} from 'lucide-react'
import { Badge, Button, Callout, Field, IconButton, Input, Modal, PageHeader, Select, Spinner } from '../../components/ui'
import PlotlyChart from '../../components/PlotlyChart'
import DataTableEditor from './DataTableEditor'
import AnalysisPanel from './AnalysisPanel'
import GraphSettings, { type GraphTemplate } from './GraphSettings'
import { useApp } from '../../app/AppContext'
import { dbDelete, dbGetAll, dbPut, getSetting, setSetting } from '../../lib/storage.js'
import { cloneDataset, emptyDataset, numericColumns, parseSpreadsheetFile, retypeDataset } from '../../lib/parse.js'
import { sampleEngineDataset } from '../../lib/sampleData.js'
import { buildPlotlyFigure, defaultConfig, normalizeConfig, regressionTrace, validateConfig } from '../../lib/graphConfig.js'
import { downloadDatasetCSV, downloadJSON, downloadText, exportPlotly, readFileAsText, readFileAsDataURL, sanitizeSvg } from '../../lib/export.js'
import { deepClone, nowIso, slugify, uid } from '../../lib/util.js'
import type { Asset, Dataset, GraphConfig, GraphRecord } from '../../types'

type SaveModal = { open: boolean; name: string }
type ExportFormat = 'png' | 'svg' | 'pdf'

export default function GraphStudio() {
  const navigate = useNavigate()
  const { notify, markSaved, bumpRefresh } = useApp()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [graphs, setGraphs] = useState<GraphRecord[]>([])
  const [templates, setTemplates] = useState<GraphTemplate[]>([])
  const [activeDatasetId, setActiveDatasetId] = useState<string>('')
  const [config, setConfig] = useState<GraphConfig>(() => defaultConfig(null))
  const [activeGraphId, setActiveGraphId] = useState<string | null>(null)
  const [activeGraphName, setActiveGraphName] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [dataEditorOpen, setDataEditorOpen] = useState(false)
  const [saveModal, setSaveModal] = useState<SaveModal>({ open: false, name: '' })
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png')
  const [exportScale, setExportScale] = useState('2')
  const [exporting, setExporting] = useState(false)
  const [fit, setFit] = useState<{ result: Record<string, any>; label: string } | null>(null)
  const [plotly, setPlotly] = useState<{ Plotly: any; div: HTMLDivElement } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const configInput = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  const activeDataset = datasets.find((dataset) => dataset.id === activeDatasetId) || null

  const updateConfig = useCallback((patch: Partial<GraphConfig>) => {
    setConfig((current) => normalizeConfig({ ...current, ...patch }))
    setDirty(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [storedDatasets, storedGraphs, storedTemplates, lastDatasetId] = await Promise.all([
          dbGetAll('datasets') as Promise<Dataset[]>,
          dbGetAll('graphs') as Promise<GraphRecord[]>,
          getSetting('graphTemplates', []) as Promise<GraphTemplate[]>,
          getSetting('lastDatasetId', '')
        ])
        let datasetList = storedDatasets
        if (!datasetList.length) {
          const sample = sampleEngineDataset()
          await dbPut('datasets', sample)
          datasetList = [sample]
        }
        if (cancelled) return
        setDatasets(datasetList)
        setGraphs(storedGraphs.filter((graph) => graph.mode !== '3d').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
        setTemplates(Array.isArray(storedTemplates) ? storedTemplates : [])
        const initial = datasetList.find((dataset) => dataset.id === lastDatasetId) || datasetList[0]
        setActiveDatasetId(initial.id)
        setConfig(defaultConfig(initial, { title: initial.name }))
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Datasets could not be loaded.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeDatasetId) return
    setSetting('lastDatasetId', activeDatasetId).catch(() => {})
  }, [activeDatasetId])

  useEffect(() => {
    if (!dirty || !activeGraphId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const record = graphs.find((graph) => graph.id === activeGraphId)
        if (!record) return
        const updated: GraphRecord = { ...record, datasetId: activeDatasetId, config: configRef.current, name: activeGraphName || record.name, updatedAt: nowIso() }
        await dbPut('graphs', updated)
        setGraphs((current) => current.map((graph) => graph.id === updated.id ? updated : graph))
        setDirty(false)
        markSaved()
        bumpRefresh()
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Autosave failed.', 'warning')
      }
    }, 900)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, activeGraphId, activeDatasetId, activeGraphName])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty && !activeGraphId) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, activeGraphId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        openSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGraphId, config, activeDatasetId])

  const validation = useMemo(() => validateConfig(activeDataset, config), [activeDataset, config])
  const figure = useMemo(() => {
    const extraTraces = fit?.result ? [regressionTrace(fit.result, '#ef4444', fit.label)].filter(Boolean) : []
    return buildPlotlyFigure(activeDataset, config, { dark: false, extraTraces })
  }, [activeDataset, config, fit])
  const plotLayout = useMemo(() => ({ ...figure.layout, autosize: true }), [figure.layout])
  const handlePlotReady = useCallback((Plotly: any, div: HTMLDivElement) => {
    setPlotly((current) => current?.Plotly === Plotly && current?.div === div ? current : { Plotly, div })
  }, [])
  const plotHeight = Math.max(340, Math.min(600, config.height))

  const chooseDataset = (id: string) => {
    const dataset = datasets.find((item) => item.id === id)
    if (!dataset) return
    setActiveDatasetId(id)
    setConfig(defaultConfig(dataset, { title: dataset.name }))
    setActiveGraphId(null)
    setActiveGraphName('')
    setFit(null)
    setDirty(false)
  }

  const openSave = () => {
    if (!activeDataset) { notify('Select or import a dataset first.', 'warning'); return }
    setSaveModal({ open: true, name: activeGraphName || config.title || `${activeDataset.name} graph` })
  }

  const saveGraph = async () => {
    const name = saveModal.name.trim()
    if (!name) return
    try {
      const existing = activeGraphId ? graphs.find((graph) => graph.id === activeGraphId) : null
      const record: GraphRecord = {
        id: existing?.id || uid('graph'),
        name,
        datasetId: activeDatasetId,
        mode: '2d',
        config: { ...config, title: config.title || name },
        analysis: fit?.result ? { fitLabel: fit.label } : undefined,
        createdAt: existing?.createdAt || nowIso(),
        updatedAt: nowIso()
      }
      await dbPut('graphs', record)
      setGraphs((current) => [record, ...current.filter((graph) => graph.id !== record.id)])
      setActiveGraphId(record.id)
      setActiveGraphName(record.name)
      setDirty(false)
      setSaveModal({ open: false, name: '' })
      markSaved()
      bumpRefresh()
      notify(`Graph "${name}" saved locally.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The graph could not be saved.', 'error')
    }
  }

  const openGraph = async (graph: GraphRecord) => {
    const dataset = datasets.find((item) => item.id === graph.datasetId)
    if (!dataset) {
      notify('The dataset for this saved graph is missing. Re-import the data first.', 'error')
      return
    }
    setActiveDatasetId(dataset.id)
    setConfig(normalizeConfig(graph.config))
    setActiveGraphId(graph.id)
    setActiveGraphName(graph.name)
    setFit(null)
    setDirty(false)
    setDataEditorOpen(false)
    notify(`Opened "${graph.name}".`, 'info')
  }

  const deleteGraph = async (id: string) => {
    if (!window.confirm('Delete this saved graph? The dataset is not deleted.')) return
    await dbDelete('graphs', id)
    setGraphs((current) => current.filter((graph) => graph.id !== id))
    if (activeGraphId === id) { setActiveGraphId(null); setActiveGraphName('') }
    bumpRefresh()
    notify('Saved graph deleted.', 'info')
  }

  const saveDataset = async (dataset: Dataset) => {
    await dbPut('datasets', dataset)
    setDatasets((current) => current.map((item) => item.id === dataset.id ? dataset : item))
    bumpRefresh()
    markSaved()
    notify(`Dataset "${dataset.name}" saved.`, 'success')
  }

  const handleImport = async (file?: File) => {
    if (!file) return
    setImporting(true)
    try {
      const result = await parseSpreadsheetFile(file)
      const dataset = result.dataset
      dataset.original = { columns: deepClone(dataset.columns), rows: deepClone(dataset.rows) }
      await dbPut('datasets', dataset)
      setDatasets((current) => [...current, dataset])
      setActiveDatasetId(dataset.id)
      setConfig(defaultConfig(dataset, { title: dataset.name }))
      setActiveGraphId(null)
      setActiveGraphName('')
      setFit(null)
      setDirty(false)
      bumpRefresh()
      markSaved()
      const warnings = result.warnings?.length ? ` ${result.warnings.length} import note(s) available in the data editor.` : ''
      notify(`Imported ${dataset.rowCount.toLocaleString()} rows × ${dataset.columnCount} columns from ${file.name}.${warnings}`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The file could not be imported.', 'error')
    } finally {
      setImporting(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const newDataset = async () => {
    const name = window.prompt('Name the new dataset', 'Untitled dataset')
    if (!name?.trim()) return
    const dataset = emptyDataset(name.trim())
    await dbPut('datasets', dataset)
    setDatasets((current) => [...current, dataset])
    chooseDataset(dataset.id)
    bumpRefresh()
    setDataEditorOpen(true)
  }

  const duplicateDataset = async () => {
    if (!activeDataset) return
    const copy = cloneDataset(activeDataset)
    await dbPut('datasets', copy)
    setDatasets((current) => [...current, copy])
    chooseDataset(copy.id)
    bumpRefresh()
    notify('Dataset duplicated.', 'success')
  }

  const renameDataset = async () => {
    if (!activeDataset) return
    const name = window.prompt('Rename dataset', activeDataset.name)
    if (!name?.trim() || name.trim() === activeDataset.name) return
    const updated = { ...activeDataset, name: name.trim(), updatedAt: nowIso() }
    await dbPut('datasets', updated)
    setDatasets((current) => current.map((item) => item.id === updated.id ? updated : item))
    bumpRefresh()
    notify('Dataset renamed.', 'success')
  }

  const deleteDataset = async () => {
    if (!activeDataset) return
    if (!window.confirm(`Delete dataset "${activeDataset.name}"? Saved graphs that use it will need the data re-imported.`)) return
    await dbDelete('datasets', activeDataset.id)
    const remaining = datasets.filter((item) => item.id !== activeDataset.id)
    setDatasets(remaining)
    if (remaining.length) chooseDataset(remaining[0].id)
    else {
      const sample = sampleEngineDataset()
      await dbPut('datasets', sample)
      setDatasets([sample])
      chooseDataset(sample.id)
    }
    setDataEditorOpen(false)
    bumpRefresh()
    notify('Dataset deleted.', 'info')
  }

  const saveTemplate = async () => {
    const name = window.prompt('Template name', `${config.plotType} template`)
    if (!name?.trim()) return
    const template = { id: uid('tpl'), name: name.trim(), config: { ...config } }
    const next = [...templates, template]
    setTemplates(next)
    await setSetting('graphTemplates', next)
    notify('Graph template saved.', 'success')
  }

  const deleteTemplate = async (id: string) => {
    const next = templates.filter((template) => template.id !== id)
    setTemplates(next)
    await setSetting('graphTemplates', next)
  }

  const applyTemplate = (template: GraphTemplate) => {
    const mapping = {
      xKey: config.xKey, yKeys: config.yKeys, secondaryYKeys: config.secondaryYKeys,
      errorKey: config.errorKey, zKey: config.zKey, title: config.title
    }
    setConfig(normalizeConfig({ ...config, ...template.config, ...mapping }))
    setDirty(true)
    notify(`Template "${template.name}" applied to the current data mapping.`, 'success')
  }

  const runExport = async () => {
    if (!plotly) { notify('Wait for the chart to finish rendering.', 'warning'); return }
    setExporting(true)
    try {
      const base = slugify(activeGraphName || config.title || activeDataset?.name || 'graph')
      const filename = `${base}.${exportFormat}`
      await exportPlotly(plotly.Plotly, plotly.div, exportFormat, filename, {
        width: config.width,
        height: config.height,
        scale: Math.max(1, Math.min(4, Number(exportScale) || 2)),
        background: config.background
      })
      notify(`${exportFormat.toUpperCase()} exported at ${config.width}×${config.height}.`, 'success')
      setExportOpen(false)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export failed.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const sendToComposer = async () => {
    if (!plotly) { notify('Wait for the chart to finish rendering.', 'warning'); return }
    try {
      const dataUrl = await plotly.Plotly.toImage(plotly.div, { format: 'svg', width: config.width, height: config.height })
      const svg = decodeURIComponent(dataUrl.split(',').slice(1).join(','))
      const clean = sanitizeSvg(svg)
      const asset: Asset = {
        id: uid('asset'),
        name: activeGraphName || config.title || 'Graph panel',
        kind: 'svg',
        data: clean,
        width: config.width,
        height: config.height,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await dbPut('assets', asset)
      bumpRefresh()
      notify('Graph sent to Figure Composer assets.', 'success')
      navigate('/figures')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The graph could not be sent to the composer.', 'error')
    }
  }

  const exportConfig = () => {
    downloadJSON({
      app: 'SciVeyra',
      kind: 'graph-config',
      schemaVersion: 1,
      exportedAt: nowIso(),
      config
    }, `${slugify(config.title || 'graph')}-config.json`)
    notify('Graph configuration exported.', 'success')
  }

  const importConfig = async (file?: File) => {
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || parsed.kind !== 'graph-config' || !parsed.config) {
        throw new Error('This is not a SciVeyra graph configuration file.')
      }
      const next = normalizeConfig(parsed.config)
      setConfig(next)
      setDirty(true)
      const missing = [next.xKey, ...next.yKeys, next.zKey, next.errorKey, next.xErrorKey].filter((key) => key && !activeDataset?.columns.some((column) => column.key === key))
      notify(missing.length ? 'Configuration loaded, but some column mappings are not present in this dataset.' : 'Graph configuration loaded.', missing.length ? 'warning' : 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Configuration import failed.', 'error')
    } finally {
      if (configInput.current) configInput.current.value = ''
    }
  }

  const addFit = (result: Record<string, any>, label: string) => setFit({ result, label })

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Spinner label="Opening Graph Studio…" /></div>

  return <div>
    <PageHeader
      eyebrow="VISUAL ANALYSIS / 01"
      title="Graph Studio"
      description="Import, edit, plot and analyse scientific data with transparent statistics."
      actions={<>
        <span className="hidden items-center gap-1.5 text-[10px] font-semibold text-slate-500 sm:flex dark:text-slate-400">
          {dirty ? <><AlertTriangle size={13} className="text-amber-500" />Unsaved changes</> : <><Check size={13} className="text-emerald-500" />{activeGraphId ? 'Saved locally' : 'Not saved yet'}</>}
        </span>
        <Button onClick={() => fileInput.current?.click()} icon={<Upload size={14} />} disabled={importing}>{importing ? 'Importing…' : 'Import CSV / Excel'}</Button>
        <Button onClick={openSave} variant="secondary" icon={<Save size={14} />}>Save graph</Button>
        <Button onClick={() => setExportOpen(true)} variant="primary" icon={<ArrowDownToLine size={14} />}>Export</Button>
      </>}
    />
    <input ref={fileInput} type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm" hidden onChange={(event) => handleImport(event.target.files?.[0])} aria-label="Import CSV or Excel file" />

    <div className="grid items-start gap-3 lg:grid-cols-[290px_minmax(0,1fr)]">
      <GraphSettings
        dataset={activeDataset}
        datasets={datasets}
        config={config}
        graphs={graphs}
        activeGraphId={activeGraphId}
        templates={templates}
        onChange={updateConfig}
        onDatasetChange={chooseDataset}
        onImport={() => fileInput.current?.click()}
        onEditData={() => setDataEditorOpen(true)}
        onNewDataset={newDataset}
        onDuplicateDataset={duplicateDataset}
        onRenameDataset={renameDataset}
        onDeleteDataset={deleteDataset}
        onOpenGraph={openGraph}
        onDeleteGraph={deleteGraph}
        onSaveGraph={openSave}
        onSaveTemplate={saveTemplate}
        onApplyTemplate={applyTemplate}
        onDeleteTemplate={deleteTemplate}
      />

      <div className="min-w-0 space-y-3">
        <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_8px_30px_rgba(27,49,88,.045)] dark:border-slate-800 dark:bg-slate-900" aria-label="Graph preview">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />LIVE PREVIEW</Badge>
                {activeDataset?.source === 'sample' && <Badge tone="amber">Synthetic sample data</Badge>}
                {config.secondaryYKeys.length > 0 && <Badge tone="slate">Secondary Y axis</Badge>}
              </div>
              <h2 className="mt-1 truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">{config.title || activeDataset?.name || 'Untitled graph'}</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{activeDataset ? `${activeDataset.name} · ${activeDataset.rowCount.toLocaleString()} rows · ${config.plotType}` : 'No dataset selected'}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <IconButton label="Send graph to Figure Composer" title="Send graph to Figure Composer" onClick={sendToComposer}><Grid2X2 size={15} /></IconButton>
              <IconButton label="Export chart" onClick={() => setExportOpen(true)}><ArrowDownToLine size={15} /></IconButton>
            </div>
          </div>

          {validation.errors.length > 0 && <div className="mb-2 space-y-1">{validation.errors.map((error) => <Callout key={error} tone="error">{error}</Callout>)}</div>}
          {validation.warnings.length > 0 && <div className="mb-2 space-y-1">{validation.warnings.map((warning) => <Callout key={warning} tone="warning">{warning}</Callout>)}</div>}
          {activeDataset?.source === 'sample' && <div className="mb-2"><Callout tone="info">This is clearly labelled <b>synthetic sample data</b>, not an experimental measurement. Import your own CSV or Excel file to replace it.</Callout></div>}

          <div style={{ height: plotHeight }} className="min-w-0 overflow-hidden rounded-lg border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950">
            <PlotlyChart
              data={figure.data}
              layout={plotLayout}
              onReady={handlePlotReady}
              className="h-full"
              ariaLabel={`${config.plotType} chart of ${activeDataset?.name || 'dataset'}`}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>{activeDataset?.rows.length.toLocaleString() || 0} rows loaded · missing values are not plotted</span>
            <span>{config.xLabel || 'X'} → {config.yKeys.length ? config.yKeys.map((key) => activeDataset?.columns.find((column) => column.key === key)?.name).filter(Boolean).join(', ') : 'no Y series'}</span>
          </div>
        </section>

        {figure.data.length === 0 && validation.errors.length === 0 && <Callout tone="warning">No chart traces were generated. Check the selected columns and plot type.</Callout>}

        <AnalysisPanel
          dataset={activeDataset}
          config={config}
          onAddFit={addFit}
          onClearFit={() => setFit(null)}
          hasFit={!!fit}
          notify={notify}
        />
      </div>
    </div>

    <Modal open={dataEditorOpen} onClose={() => setDataEditorOpen(false)} title={activeDataset ? `Edit dataset: ${activeDataset.name}` : 'Edit dataset'} wide>
      {activeDataset ? <DataTableEditor
        dataset={activeDataset}
        onSave={saveDataset}
        onDelete={deleteDataset}
        onDuplicate={duplicateDataset}
        onClose={() => setDataEditorOpen(false)}
      /> : <Callout tone="warning">No dataset is selected.</Callout>}
    </Modal>

    <Modal open={saveModal.open} onClose={() => setSaveModal({ open: false, name: '' })} title="Save graph"
      footer={<><Button variant="ghost" onClick={() => setSaveModal({ open: false, name: '' })}>Cancel</Button><Button variant="primary" onClick={saveGraph} icon={<Save size={14} />}>Save locally</Button></>}>
      <Field label="Graph name" required hint="Saved in this browser with the current dataset mapping and style.">
        <Input value={saveModal.name} onChange={(event) => setSaveModal({ open: true, name: event.target.value })} onKeyDown={(event) => event.key === 'Enter' && saveGraph()} autoFocus />
      </Field>
      <Callout tone="info">Use Settings → Backup to export all local projects, datasets and references.</Callout>
    </Modal>

    <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export graph"
      footer={<><Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button><Button variant="primary" onClick={runExport} disabled={exporting} icon={<ArrowDownToLine size={14} />}>{exporting ? 'Exporting…' : 'Download'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Format">
          <Select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)}>
            <option value="png">PNG (raster image)</option>
            <option value="svg">SVG (vector chart)</option>
            <option value="pdf">PDF (raster embedded)</option>
          </Select>
        </Field>
        <Field label="PNG/PDF scale" hint="2× is recommended for print previews.">
          <Select value={exportScale} onChange={(event) => setExportScale(event.target.value)} disabled={exportFormat === 'svg'}>
            <option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option>
          </Select>
        </Field>
        <Field label="Width (px)"><Input type="number" min={320} max={4000} value={config.width} onChange={(event) => updateConfig({ width: Number(event.target.value) || 900 })} /></Field>
        <Field label="Height (px)"><Input type="number" min={240} max={4000} value={config.height} onChange={(event) => updateConfig({ height: Number(event.target.value) || 560 })} /></Field>
      </div>
      <div className="mt-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Also available</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => downloadDatasetCSV(activeDataset, `${slugify(activeDataset?.name || 'dataset')}.csv`)} icon={<FileText size={13} />}>Data CSV</Button>
          <Button size="sm" variant="secondary" onClick={exportConfig} icon={<FileJson size={13} />}>Config JSON</Button>
          <Button size="sm" variant="secondary" onClick={() => configInput.current?.click()} icon={<Upload size={13} />}>Import config</Button>
          <Button size="sm" variant="secondary" onClick={sendToComposer} icon={<Grid2X2 size={13} />}>Send to Figure Composer</Button>
          <input ref={configInput} type="file" accept=".json,application/json" hidden onChange={(event) => importConfig(event.target.files?.[0])} aria-label="Import graph configuration" />
        </div>
      </div>
      <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
        <p><b>SVG:</b> preserves vector chart elements from Plotly. Font rendering may vary between viewers; embed or convert fonts if your journal requires it.</p>
        <p><b>PDF:</b> generated by embedding a high-resolution PNG in a PDF. It is not a native vector PDF. Export SVG for vector workflows.</p>
        <p><b>PNG:</b> exported at the configured width and height multiplied by the selected scale.</p>
      </div>
    </Modal>
  </div>
}

