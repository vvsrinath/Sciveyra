import { ChevronRight, Database, FileDown, Layers, Palette, Plus, Ruler, Save, SlidersHorizontal, Trash2, Type, Upload, X } from 'lucide-react'
import { Badge, Button, Collapsible, Field, IconButton, Input, Select, Toggle } from '../../components/ui'
import { COLORSCALES, FONTS, MARKER_SHAPES, PALETTE, PLOT_TYPES } from '../../lib/graphConfig.js'
import { numericColumns } from '../../lib/parse.js'
import type { Dataset, GraphConfig, GraphRecord, RefLine, ChartAnnotation } from '../../types'

export type GraphTemplate = { id: string; name: string; config: GraphConfig }

type Props = {
  dataset: Dataset | null
  datasets: Dataset[]
  config: GraphConfig
  graphs: GraphRecord[]
  activeGraphId: string | null
  templates: GraphTemplate[]
  onChange: (patch: Partial<GraphConfig>) => void
  onDatasetChange: (id: string) => void
  onImport: () => void
  onEditData: () => void
  onNewDataset: () => void
  onDuplicateDataset: () => void
  onRenameDataset: () => void
  onDeleteDataset: () => void
  onOpenGraph: (graph: GraphRecord) => void
  onDeleteGraph: (id: string) => void
  onSaveGraph: () => void
  onSaveTemplate: () => void
  onApplyTemplate: (template: GraphTemplate) => void
  onDeleteTemplate: (id: string) => void
}

export default function GraphSettings(props: Props) {
  const {
    dataset, datasets, config, graphs, activeGraphId, templates, onChange, onDatasetChange,
    onImport, onEditData, onNewDataset, onDuplicateDataset, onRenameDataset, onDeleteDataset,
    onOpenGraph, onDeleteGraph, onSaveGraph, onSaveTemplate, onApplyTemplate, onDeleteTemplate
  } = props
  const numeric = numericColumns(dataset)
  const gridMode = ['heatmap', 'contour'].includes(config.plotType)
  const toggleY = (key: string) => {
    const selected = config.yKeys.includes(key)
    const yKeys = selected ? config.yKeys.filter((item) => item !== key) : [...config.yKeys, key]
    const secondaryYKeys = selected ? config.secondaryYKeys.filter((item) => item !== key) : config.secondaryYKeys
    onChange({ yKeys, secondaryYKeys })
  }
  const toggleSecondary = (key: string) => {
    const secondary = config.secondaryYKeys.includes(key)
    onChange({ secondaryYKeys: secondary ? config.secondaryYKeys.filter((item) => item !== key) : [...config.secondaryYKeys, key] })
  }
  const setColor = (index: number, color: string) => {
    const colors = [...config.colors]
    colors[index] = color
    onChange({ colors })
  }
  const updateRef = (index: number, patch: Partial<RefLine>) => {
    onChange({ refLines: config.refLines.map((line, i) => (i === index ? { ...line, ...patch } : line)) })
  }
  const updateAnnotation = (index: number, patch: Partial<ChartAnnotation>) => {
    onChange({ annotations: config.annotations.map((note, i) => (i === index ? { ...note, ...patch } : note)) })
  }

  return <aside className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_8px_30px_rgba(27,49,88,.045)] dark:border-slate-800 dark:bg-slate-900" aria-label="Graph settings">
    <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-700 dark:text-slate-200"><SlidersHorizontal size={15} className="text-blue-500" />Graph settings</div>

    <Collapsible title="Data" icon={<Database size={13} />}>
      <Field label="Dataset">
        <Select value={dataset?.id || ''} onChange={(event) => onDatasetChange(event.target.value)} aria-label="Active dataset">
          {!datasets.length && <option value="">No datasets</option>}
          {datasets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Button size="sm" onClick={onImport} icon={<Upload size={12} />}>Import</Button>
        <Button size="sm" onClick={onEditData} disabled={!dataset} icon={<Database size={12} />}>Edit table</Button>
        <Button size="sm" variant="ghost" onClick={onNewDataset} icon={<Plus size={12} />}>New</Button>
        <Button size="sm" variant="ghost" onClick={onDuplicateDataset} disabled={!dataset}>Duplicate</Button>
        <Button size="sm" variant="ghost" onClick={onRenameDataset} disabled={!dataset}>Rename</Button>
        <Button size="sm" variant="ghost" onClick={onDeleteDataset} disabled={!dataset}>Delete</Button>
      </div>
      {dataset && <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400">
        <span>{dataset.rowCount.toLocaleString()} rows</span><span>·</span><span>{dataset.columnCount} cols</span>
        {dataset.source === 'sample' && <Badge tone="amber">sample data</Badge>}
      </div>}
    </Collapsible>

    <Collapsible title="Plot type" icon={<Layers size={13} />}>
      <div className="grid grid-cols-2 gap-1.5">
        {PLOT_TYPES.map((type) => <button key={type.id} type="button" onClick={() => onChange({ plotType: type.id })}
          className={`rounded-md border px-2 py-1.5 text-[10px] font-bold transition ${config.plotType === type.id ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}
        >{type.label}</button>)}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">3D scatter, surface and mesh plots are in 3D Graph Studio.</p>
    </Collapsible>

    <Collapsible title="Data mapping" icon={<ChevronRight size={13} />}>
      {gridMode ? <>
        <Field label="X column"><Select value={config.xKey} onChange={(event) => onChange({ xKey: event.target.value })}>{numeric.map((column) => <option key={column.key} value={column.key}>{column.name}</option>)}</Select></Field>
        <Field label="Y column (grid rows)" className="mt-2"><Select value={config.yKeys[0] || ''} onChange={(event) => onChange({ yKeys: event.target.value ? [event.target.value] : [] })}>{numeric.map((column) => <option key={column.key} value={column.key}>{column.name}</option>)}</Select></Field>
        <Field label="Z column (values)" className="mt-2"><Select value={config.zKey} onChange={(event) => onChange({ zKey: event.target.value })}>{numeric.map((column) => <option key={column.key} value={column.key}>{column.name}</option>)}</Select></Field>
      </> : <>
        <Field label="X column"><Select value={config.xKey} onChange={(event) => onChange({ xKey: event.target.value })}>{numeric.map((column) => <option key={column.key} value={column.key}>{column.name}</option>)}</Select></Field>
        <div className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Y series</div>
        <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-slate-100 p-1.5 dark:border-slate-800">
          {numeric.filter((column) => column.key !== config.xKey).map((column) => <div key={column.key} className="flex items-center gap-1.5">
            <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={config.yKeys.includes(column.key)} onChange={() => toggleY(column.key)} />
              <span className="truncate">{column.name}</span>
            </label>
            <button type="button" title="Use secondary Y axis" aria-label={`Use secondary Y axis for ${column.name}`} disabled={!config.yKeys.includes(column.key)} onClick={() => toggleSecondary(column.key)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold ${config.secondaryYKeys.includes(column.key) ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300' : 'text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800'}`}>2°</button>
          </div>)}
          {!numeric.length && <p className="p-2 text-[10px] text-slate-400">No numeric columns found.</p>}
        </div>
        {!['histogram', 'box'].includes(config.plotType) && <Field label="Error bar column (first Y)" className="mt-2" hint="Symmetric absolute error magnitudes. Negative values are ignored.">
          <Select value={config.errorKey} onChange={(event) => onChange({ errorKey: event.target.value })}>
            <option value="">None</option>
            {numeric.map((column) => <option key={column.key} value={column.key}>{column.name}</option>)}
          </Select>
        </Field>}
        {!['histogram', 'box'].includes(config.plotType) && <Field label="X error column (horizontal)" className="mt-2" hint="Optional symmetric horizontal error magnitudes.">
          <Select value={config.xErrorKey} onChange={(event) => onChange({ xErrorKey: event.target.value })}>
            <option value="">None</option>
            {numeric.map((column) => <option key={column.key} value={column.key}>{column.name}</option>)}
          </Select>
        </Field>}
      </>}
    </Collapsible>

    <Collapsible title="Text & axes" icon={<Type size={13} />}>
      <Field label="Chart title"><Input value={config.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Chart title" /></Field>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="X title"><Input value={config.xLabel} onChange={(event) => onChange({ xLabel: event.target.value })} /></Field>
        <Field label="Y title"><Input value={config.yLabel} onChange={(event) => onChange({ yLabel: event.target.value })} /></Field>
      </div>
      {config.secondaryYKeys.length > 0 && <Field label="Secondary Y title" className="mt-2"><Input value={config.y2Label} onChange={(event) => onChange({ y2Label: event.target.value })} /></Field>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="X min"><Input type="number" value={config.xMin} onChange={(event) => onChange({ xMin: event.target.value })} placeholder="auto" /></Field>
        <Field label="X max"><Input type="number" value={config.xMax} onChange={(event) => onChange({ xMax: event.target.value })} placeholder="auto" /></Field>
        <Field label="Y min"><Input type="number" value={config.yMin} onChange={(event) => onChange({ yMin: event.target.value })} placeholder="auto" /></Field>
        <Field label="Y max"><Input type="number" value={config.yMax} onChange={(event) => onChange({ yMax: event.target.value })} placeholder="auto" /></Field>
      </div>
      {config.secondaryYKeys.length > 0 && <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Y2 min"><Input type="number" value={config.y2Min} onChange={(event) => onChange({ y2Min: event.target.value })} placeholder="auto" /></Field>
        <Field label="Y2 max"><Input type="number" value={config.y2Max} onChange={(event) => onChange({ y2Max: event.target.value })} placeholder="auto" /></Field>
      </div>}
      <Toggle label="Logarithmic X axis" checked={config.logX} onChange={(value) => onChange({ logX: value })} />
      <Toggle label="Logarithmic Y axis" checked={config.logY} onChange={(value) => onChange({ logY: value })} />
      <Toggle label="Show grid" checked={config.showGrid} onChange={(value) => onChange({ showGrid: value })} />
      <Toggle label="Minor ticks" checked={config.showMinorTicks} onChange={(value) => onChange({ showMinorTicks: value })} />
      <Field label="Tick format (D3)" hint="Examples: .2f, .1e, .0%" className="mt-2"><Input value={config.tickFormat} onChange={(event) => onChange({ tickFormat: event.target.value })} placeholder="auto" /></Field>
    </Collapsible>

    <Collapsible title="Style" icon={<Palette size={13} />} defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Font"><Select value={config.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value })}>{FONTS.map((font) => <option key={font} value={font}>{font}</option>)}</Select></Field>
        <Field label="Font size"><Input type="number" min={8} max={30} value={config.fontSize} onChange={(event) => onChange({ fontSize: Number(event.target.value) || 13 })} /></Field>
        <Field label="Line width"><Input type="number" min={0.5} max={12} step={0.5} value={config.lineWidth} onChange={(event) => onChange({ lineWidth: Number(event.target.value) || 1 })} /></Field>
        <Field label="Marker size"><Input type="number" min={1} max={30} value={config.markerSize} onChange={(event) => onChange({ markerSize: Number(event.target.value) || 5 })} /></Field>
        <Field label="Marker shape"><Select value={config.markerShape} onChange={(event) => onChange({ markerShape: event.target.value })}>{MARKER_SHAPES.map((shape) => <option key={shape} value={shape}>{shape}</option>)}</Select></Field>
        <Field label="Line dash"><Select value={config.lineDash} onChange={(event) => onChange({ lineDash: event.target.value })}><option value="solid">solid</option><option value="dot">dot</option><option value="dash">dash</option><option value="longdash">long dash</option><option value="dashdot">dash-dot</option></Select></Field>
        <Field label="Legend"><Select value={config.legendPosition} onChange={(event) => onChange({ legendPosition: event.target.value })}><option value="top-right">Top right</option><option value="top-left">Top left</option><option value="bottom-right">Bottom right</option><option value="bottom-left">Bottom left</option><option value="top-center">Top center</option></Select></Field>
      </div>
      {config.plotType === 'bar' && <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Bar mode"><Select value={config.barMode} onChange={(event) => onChange({ barMode: event.target.value })}><option value="group">Grouped</option><option value="stack">Stacked</option><option value="relative">Relative</option><option value="overlay">Overlay</option></Select></Field>
        <Field label="Bar gap"><Input type="number" min={0} max={0.9} step={0.05} value={config.bargap} onChange={(event) => onChange({ bargap: Number(event.target.value) })} /></Field>
      </div>}
      {config.plotType === 'histogram' && <Field label="Histogram bins" className="mt-2" hint="0 lets Plotly choose the bin count automatically."><Input type="number" min={0} max={200} value={config.histogramBins} onChange={(event) => onChange({ histogramBins: Number(event.target.value) || 0 })} /></Field>}
      {config.plotType === 'box' && <Field label="Box points" className="mt-2"><Select value={config.boxPoints} onChange={(event) => onChange({ boxPoints: event.target.value })}><option value="outliers">Outliers only</option><option value="suspectedoutliers">Suspected outliers</option><option value="all">All points</option><option value="none">None</option></Select></Field>}
      {['line', 'area', 'spectrum', 'errorbar'].includes(config.plotType) && <Field label="Line shape" className="mt-2"><Select value={config.lineShape} onChange={(event) => onChange({ lineShape: event.target.value })}><option value="linear">Linear</option><option value="spline">Spline</option><option value="hv">Step (horizontal)</option><option value="vh">Step (vertical)</option><option value="hvh">Step (mid)</option></Select></Field>}
      <Toggle label="Show legend" checked={config.showLegend} onChange={(value) => onChange({ showLegend: value })} />
      <Toggle label="Show markers" checked={config.showMarkers} onChange={(value) => onChange({ showMarkers: value })} />
      <Toggle label="Smooth line (spline)" checked={config.smoothing} onChange={(value) => onChange({ smoothing: value })} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Background"><input type="color" aria-label="Chart background" value={config.background} onChange={(event) => onChange({ background: event.target.value })} className="h-9 w-full rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></Field>
        <Field label="Plot area"><input type="color" aria-label="Plot area background" value={config.plotBackground} onChange={(event) => onChange({ plotBackground: event.target.value })} className="h-9 w-full rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></Field>
      </div>
      {!gridMode && <div className="mt-2">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Series colors</div>
        <div className="flex flex-wrap gap-1.5">
          {config.yKeys.map((key, index) => <input key={key} type="color" aria-label={`Color for ${key}`} value={config.colors[index] || PALETTE[index % PALETTE.length]} onChange={(event) => setColor(index, event.target.value)} className="h-7 w-9 rounded border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900" />)}
          {!config.yKeys.length && <span className="text-[10px] text-slate-400">Select Y series to edit colors.</span>}
        </div>
      </div>}
      {gridMode && <>
        <Field label="Color scale" className="mt-2"><Select value={config.colorscale} onChange={(event) => onChange({ colorscale: event.target.value })}>{Object.keys(COLORSCALES).map((scale) => <option key={scale} value={scale}>{scale}</option>)}</Select></Field>
        <Toggle label="Reverse color scale" checked={config.reverseColorscale} onChange={(value) => onChange({ reverseColorscale: value })} />
      </>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Export width"><Input type="number" min={320} max={4000} value={config.width} onChange={(event) => onChange({ width: Number(event.target.value) || 1000 })} /></Field>
        <Field label="Export height"><Input type="number" min={240} max={4000} value={config.height} onChange={(event) => onChange({ height: Number(event.target.value) || 620 })} /></Field>
      </div>
    </Collapsible>

    <Collapsible title="Reference lines & notes" icon={<Ruler size={13} />} defaultOpen={false}>
      <div className="space-y-1.5">
        {config.refLines.map((line, index) => <div key={index} className="flex items-center gap-1">
          <select aria-label="Reference line axis" value={line.axis} onChange={(event) => updateRef(index, { axis: event.target.value as 'x' | 'y' })} className="h-8 w-14 rounded border border-slate-200 bg-white px-1 text-[10px] dark:border-slate-700 dark:bg-slate-900">
            <option value="x">X</option><option value="y">Y</option>
          </select>
          <input type="number" aria-label="Reference line value" value={line.value} onChange={(event) => updateRef(index, { value: event.target.value })} className="h-8 min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 text-[10px] dark:border-slate-700 dark:bg-slate-900" />
          <input type="color" aria-label="Reference line color" value={line.color || '#ef4444'} onChange={(event) => updateRef(index, { color: event.target.value })} className="h-8 w-8 rounded border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900" />
          <button type="button" aria-label="Remove reference line" onClick={() => onChange({ refLines: config.refLines.filter((_, i) => i !== index) })} className="text-slate-400 hover:text-red-500"><X size={13} /></button>
        </div>)}
        <Button size="sm" variant="ghost" onClick={() => onChange({ refLines: [...config.refLines, { axis: 'y', value: 0, color: '#ef4444' }] })} icon={<Plus size={12} />}>Add reference line</Button>
      </div>
      <div className="mt-3 space-y-1.5">
        {config.annotations.map((note, index) => <div key={index} className="rounded-md border border-slate-100 p-1.5 dark:border-slate-800">
          <div className="flex items-center gap-1">
            <input value={note.text} aria-label="Annotation text" placeholder="Annotation text" onChange={(event) => updateAnnotation(index, { text: event.target.value })} className="h-8 min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 text-[10px] dark:border-slate-700 dark:bg-slate-900" />
            <button type="button" aria-label="Remove annotation" onClick={() => onChange({ annotations: config.annotations.filter((_, i) => i !== index) })} className="text-slate-400 hover:text-red-500"><X size={13} /></button>
          </div>
          <div className="mt-1 flex gap-1">
            <input value={note.x ?? ''} aria-label="Annotation X" placeholder="x (data)" onChange={(event) => updateAnnotation(index, { x: event.target.value })} className="h-7 min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 text-[10px] dark:border-slate-700 dark:bg-slate-900" />
            <input value={note.y ?? ''} aria-label="Annotation Y" placeholder="y (data)" onChange={(event) => updateAnnotation(index, { y: event.target.value })} className="h-7 min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 text-[10px] dark:border-slate-700 dark:bg-slate-900" />
            <label className="flex items-center gap-1 text-[9px] text-slate-500"><input type="checkbox" checked={!!note.arrow} onChange={(event) => updateAnnotation(index, { arrow: event.target.checked })} />arrow</label>
          </div>
        </div>)}
        <Button size="sm" variant="ghost" onClick={() => onChange({ annotations: [...config.annotations, { text: '', x: '', y: '' }] })} icon={<Plus size={12} />}>Add annotation</Button>
      </div>
    </Collapsible>

    <Collapsible title="Saved graphs & templates" icon={<Save size={13} />} defaultOpen={false}>
      <Button size="sm" variant="primary" className="w-full" onClick={onSaveGraph} icon={<Save size={12} />}>Save current graph</Button>
      <div className="mt-2 max-h-36 space-y-1 overflow-auto">
        {graphs.map((graph) => <div key={graph.id} className={`flex items-center gap-1 rounded-md border p-1.5 ${activeGraphId === graph.id ? 'border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30' : 'border-slate-100 dark:border-slate-800'}`}>
          <button type="button" onClick={() => onOpenGraph(graph)} className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-300">{graph.name}</button>
          <button type="button" aria-label={`Delete saved graph ${graph.name}`} onClick={() => onDeleteGraph(graph.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
        </div>)}
        {!graphs.length && <p className="text-[10px] text-slate-400">No saved graphs yet.</p>}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Templates</div>
        <div className="space-y-1">
          {templates.map((template) => <div key={template.id} className="flex items-center gap-1">
            <button type="button" onClick={() => onApplyTemplate(template)} className="min-w-0 flex-1 truncate text-left text-[10px] text-slate-600 hover:text-blue-600 dark:text-slate-300">{template.name}</button>
            <button type="button" aria-label={`Delete template ${template.name}`} onClick={() => onDeleteTemplate(template.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
          </div>)}
        </div>
        <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={onSaveTemplate} icon={<FileDown size={12} />}>Save current as template</Button>
      </div>
    </Collapsible>
  </aside>
}
