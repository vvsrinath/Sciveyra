import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine, Circle, Copy, Diamond, Download, Grid3X3, Minus, Plus, Redo2,
  Save, Share2, Square, Trash2, Type, Undo2
} from 'lucide-react'
import { Badge, Button, Callout, Card, Field, Input, Modal, PageHeader, Select, Spinner, Toggle } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { dbDelete, dbGetAll, dbPut } from '../../lib/storage.js'
import { downloadBlob, downloadText, sanitizeSvg, svgToPdf, svgToPngBlob } from '../../lib/export.js'
import { nowIso, pluralize, slugify, uid } from '../../lib/util.js'
import type { DiagramEdge, DiagramNode, DiagramNodeShape, DiagramRecord } from '../../types'

const WIDTH = 1200
const HEIGHT = 800

const SHAPES: { shape: DiagramNodeShape; label: string; icon: React.ReactNode }[] = [
  { shape: 'rect', label: 'Box', icon: <Square size={13} /> },
  { shape: 'rounded', label: 'Rounded', icon: <Square size={13} className="rounded-sm" /> },
  { shape: 'circle', label: 'Circle', icon: <Circle size={13} /> },
  { shape: 'diamond', label: 'Decision', icon: <Diamond size={13} /> },
  { shape: 'text', label: 'Text', icon: <Type size={13} /> }
]

const DEFAULT_FILL: Record<DiagramNodeShape, string> = {
  rect: '#eff6ff', rounded: '#ecfdf5', circle: '#fef3c7', diamond: '#fdf2f8', text: '#ffffff'
}
const DEFAULT_STROKE: Record<DiagramNodeShape, string> = {
  rect: '#3779f6', rounded: '#059669', circle: '#d97706', diamond: '#db2777', text: '#ffffff'
}

const newDiagram = (): DiagramRecord => ({
  id: uid('diagram'), name: 'Untitled diagram', nodes: [], edges: [], createdAt: nowIso(), updatedAt: nowIso()
})

function escapeXml(value: string) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function wrapText(text: string, limit = 18): string[] {
  const paragraphs = String(text || '').split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    let current = ''
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue
      if ((current + ' ' + word).trim().length > limit && current) { lines.push(current); current = word }
      else current = (current + ' ' + word).trim()
    }
    if (current) lines.push(current)
  }
  return lines.length ? lines : ['']
}

function nodeGeometry(node: DiagramNode) {
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  const hw = Math.max(1, node.width / 2)
  const hh = Math.max(1, node.height / 2)
  return { cx, cy, hw, hh }
}

function boundary(node: DiagramNode, towardX: number, towardY: number) {
  const { cx, cy, hw, hh } = nodeGeometry(node)
  const dx = towardX - cx
  const dy = towardY - cy
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy }
  if (node.shape === 'circle') {
    const length = Math.hypot(dx, dy) || 1
    return { x: cx + dx / length * Math.min(hw, hh), y: cy + dy / length * Math.min(hw, hh) }
  }
  const t = Math.min(hw / Math.abs(dx || 0.001), hh / Math.abs(dy || 0.001))
  return { x: cx + dx * t, y: cy + dy * t }
}

function edgePoints(edge: DiagramEdge, nodes: DiagramNode[]) {
  const from = nodes.find((node) => node.id === edge.from)
  const to = nodes.find((node) => node.id === edge.to)
  if (!from || !to) return null
  const a = nodeGeometry(from)
  const b = nodeGeometry(to)
  const start = boundary(from, b.cx, b.cy)
  const end = boundary(to, a.cx, a.cy)
  return { start, end, mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } }
}

export function diagramToSvg(diagram: DiagramRecord, showGrid = false): string {
  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`)
  parts.push('<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker></defs>')
  parts.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>`)
  if (showGrid) {
    for (let x = 0; x <= WIDTH; x += 40) parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${HEIGHT}" stroke="#eef2f7" stroke-width="1"/>`)
    for (let y = 0; y <= HEIGHT; y += 40) parts.push(`<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="#eef2f7" stroke-width="1"/>`)
  }
  for (const edge of diagram.edges) {
    const points = edgePoints(edge, diagram.nodes)
    if (!points) continue
    parts.push(`<line x1="${points.start.x.toFixed(1)}" y1="${points.start.y.toFixed(1)}" x2="${points.end.x.toFixed(1)}" y2="${points.end.y.toFixed(1)}" stroke="#475569" stroke-width="2"${edge.dashed ? ' stroke-dasharray="8 5"' : ''}${edge.arrow === false ? '' : ' marker-end="url(#arrow)"'}/>`)
    if (edge.label) {
      const width = Math.max(30, edge.label.length * 7.2 + 12)
      parts.push(`<rect x="${(points.mid.x - width / 2).toFixed(1)}" y="${(points.mid.y - 12).toFixed(1)}" width="${width.toFixed(1)}" height="20" rx="4" fill="#ffffff" opacity="0.92"/>`)
      parts.push(`<text x="${points.mid.x.toFixed(1)}" y="${(points.mid.y + 3).toFixed(1)}" text-anchor="middle" font-family="Arial" font-size="12" fill="#475569">${escapeXml(edge.label)}</text>`)
    }
  }
  for (const node of diagram.nodes) {
    if (node.shape === 'rect' || node.shape === 'rounded' || node.shape === 'text') {
      const rx = node.shape === 'rounded' ? 18 : node.shape === 'text' ? 0 : 4
      parts.push(`<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${rx}" fill="${escapeXml(node.fill)}"${node.shape === 'text' ? '' : ` stroke="${escapeXml(node.stroke)}" stroke-width="2"`}/>`)
    } else if (node.shape === 'circle') {
      parts.push(`<ellipse cx="${node.x + node.width / 2}" cy="${node.y + node.height / 2}" rx="${node.width / 2}" ry="${node.height / 2}" fill="${escapeXml(node.fill)}" stroke="${escapeXml(node.stroke)}" stroke-width="2"/>`)
    } else {
      const cx = node.x + node.width / 2
      const cy = node.y + node.height / 2
      parts.push(`<polygon points="${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + node.height} ${node.x},${cy}" fill="${escapeXml(node.fill)}" stroke="${escapeXml(node.stroke)}" stroke-width="2"/>`)
    }
    const lines = wrapText(node.text, Math.max(8, Math.floor(node.width / Math.max(7, node.fontSize * 0.58))))
    const lineHeight = node.fontSize * 1.25
    const startY = node.y + node.height / 2 - ((lines.length - 1) * lineHeight) / 2 + node.fontSize * 0.35
    parts.push(`<text x="${node.x + node.width / 2}" y="${startY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${node.fontSize}" fill="${escapeXml(node.textColor || '#1e293b')}">`)
    lines.forEach((line, index) => { parts.push(`<tspan x="${node.x + node.width / 2}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`) })
    parts.push('</text>')
  }
  parts.push('</svg>')
  return parts.join('')
}

export default function DiagramStudio() {
  const { notify, refreshToken, bumpRefresh, markSaved } = useApp()
  const [diagrams, setDiagrams] = useState<DiagramRecord[]>([])
  const [diagram, setDiagram] = useState<DiagramRecord>(newDiagram)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [undoStack, setUndoStack] = useState<DiagramRecord[]>([])
  const [redoStack, setRedoStack] = useState<DiagramRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [exporting, setExporting] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ id: string; startX: number; startY: number; orig: DiagramNode } | null>(null)
  const diagramRef = useRef(diagram)
  diagramRef.current = diagram

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await dbGetAll('diagrams') as DiagramRecord[]
        if (!cancelled) setDiagrams(list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Diagrams could not be loaded.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const commit = (next: DiagramRecord) => {
    setUndoStack((stack) => [...stack.slice(-29), diagramRef.current])
    setRedoStack([])
    setDiagram({ ...next, updatedAt: nowIso() })
    setDirty(true)
  }

  const update = (patch: Partial<DiagramRecord>, history = true) => {
    const next = { ...diagramRef.current, ...patch, updatedAt: nowIso() }
    if (history) commit(next)
    else setDiagram(next)
  }

  const updateNode = (id: string, patch: Partial<DiagramNode>, history = true) => {
    update({ nodes: diagramRef.current.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) }, history)
  }

  const updateEdge = (id: string, patch: Partial<DiagramEdge>, history = true) => {
    update({ edges: diagramRef.current.edges.map((edge) => edge.id === id ? { ...edge, ...patch } : edge) }, history)
  }

  const undo = () => {
    if (!undoStack.length) return
    setRedoStack((stack) => [...stack, diagramRef.current])
    setDiagram(undoStack[undoStack.length - 1])
    setUndoStack(undoStack.slice(0, -1))
    setDirty(true)
  }

  const redo = () => {
    if (!redoStack.length) return
    setUndoStack((stack) => [...stack, diagramRef.current])
    setDiagram(redoStack[redoStack.length - 1])
    setRedoStack(redoStack.slice(0, -1))
    setDirty(true)
  }

  const addNode = (shape: DiagramNodeShape) => {
    const index = diagram.nodes.length
    const node: DiagramNode = {
      id: uid('node'), shape, text: shape === 'diamond' ? 'Condition?' : 'New node',
      x: 80 + (index % 4) * 230, y: 80 + Math.floor(index / 4) * 150,
      width: shape === 'diamond' || shape === 'circle' ? 150 : 180,
      height: shape === 'circle' ? 110 : shape === 'text' ? 48 : 90,
      fill: DEFAULT_FILL[shape], stroke: DEFAULT_STROKE[shape], fontSize: 14, textColor: '#1e293b'
    }
    update({ nodes: [...diagram.nodes, node] })
    setSelectedNode(node.id)
    setSelectedEdge(null)
  }

  const addEdge = (from: string, to: string) => {
    if (from === to) { notify('Choose a different target node.', 'warning'); return }
    const edge: DiagramEdge = { id: uid('edge'), from, to, label: '', dashed: false, arrow: true }
    update({ edges: [...diagram.edges, edge] })
    setSelectedEdge(edge.id)
    setSelectedNode(null)
    setConnectFrom(null)
    setConnectMode(false)
  }

  const selectNode = (node: DiagramNode) => {
    if (connectMode) {
      if (!connectFrom) { setConnectFrom(node.id); setSelectedNode(node.id); notify('Now click the target node to create a connection.', 'info') }
      else addEdge(connectFrom, node.id)
      return
    }
    setSelectedNode(node.id)
    setSelectedEdge(null)
  }

  const deleteSelection = () => {
    if (selectedNode) {
      update({ nodes: diagram.nodes.filter((node) => node.id !== selectedNode), edges: diagram.edges.filter((edge) => edge.from !== selectedNode && edge.to !== selectedNode) })
      setSelectedNode(null)
    } else if (selectedEdge) {
      update({ edges: diagram.edges.filter((edge) => edge.id !== selectedEdge) })
      setSelectedEdge(null)
    }
  }

  const duplicateNode = (id: string) => {
    const node = diagram.nodes.find((item) => item.id === id)
    if (!node) return
    const copy = { ...node, id: uid('node'), x: node.x + 28, y: node.y + 28 }
    update({ nodes: [...diagram.nodes, copy] })
    setSelectedNode(copy.id)
  }

  const toPoint = (event: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT }
  }

  const startDrag = (event: React.PointerEvent, node: DiagramNode) => {
    if (connectMode) return
    event.stopPropagation()
    setSelectedNode(node.id)
    setSelectedEdge(null)
    const point = toPoint(event)
    dragRef.current = { id: node.id, startX: point.x, startY: point.y, orig: { ...node } }
    setUndoStack((stack) => [...stack.slice(-29), diagramRef.current])
    setRedoStack([])
    ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const point = toPoint(event)
    updateNode(drag.id, {
      x: Math.round(Math.max(0, Math.min(WIDTH - drag.orig.width, drag.orig.x + point.x - drag.startX))),
      y: Math.round(Math.max(0, Math.min(HEIGHT - drag.orig.height, drag.orig.y + point.y - drag.startY)))
    }, false)
    setDirty(true)
  }

  const save = async () => {
    const name = (saveName || diagram.name || 'Untitled diagram').trim()
    try {
      const record = { ...diagramRef.current, name, updatedAt: nowIso() }
      await dbPut('diagrams', record)
      setDiagram(record)
      setDiagrams((list) => [record, ...list.filter((item) => item.id !== record.id)])
      setDirty(false)
      setSaveOpen(false)
      setSaveName('')
      markSaved()
      bumpRefresh()
      notify(`Diagram "${name}" saved locally.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The diagram could not be saved.', 'error')
    }
  }

  const openDiagram = (record: DiagramRecord) => {
    setDiagram(record)
    setUndoStack([])
    setRedoStack([])
    setSelectedNode(null)
    setSelectedEdge(null)
    setConnectFrom(null)
    setConnectMode(false)
    setDirty(false)
  }

  const newDiagramRecord = () => {
    if (dirty && !window.confirm('Discard unsaved changes and start a new diagram?')) return
    setDiagram(newDiagram())
    setUndoStack([])
    setRedoStack([])
    setSelectedNode(null)
    setSelectedEdge(null)
    setDirty(false)
  }

  const deleteDiagram = async (id: string) => {
    if (!window.confirm('Delete this saved diagram?')) return
    await dbDelete('diagrams', id)
    setDiagrams((list) => list.filter((item) => item.id !== id))
    if (diagram.id === id) newDiagramRecord()
    bumpRefresh()
    notify('Diagram deleted.', 'info')
  }

  const exportDiagram = async (format: 'svg' | 'png' | 'pdf') => {
    if (!diagram.nodes.length) { notify('Add at least one node before exporting.', 'warning'); return }
    setExporting(true)
    try {
      const svg = sanitizeSvg(diagramToSvg(diagramRef.current, showGrid))
      const base = slugify(diagram.name || 'diagram')
      if (format === 'svg') downloadText(svg, `${base}.svg`, 'image/svg+xml;charset=utf-8')
      else if (format === 'png') downloadBlob(await svgToPngBlob(svg, { width: WIDTH, height: HEIGHT, scale: 2, background: '#ffffff' }), `${base}.png`)
      else await svgToPdf(svg, `${base}.pdf`, { width: WIDTH, height: HEIGHT, scale: 2, background: '#ffffff' })
      notify(`${format.toUpperCase()} exported with real vector elements.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export failed.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const selected = diagram.nodes.find((node) => node.id === selectedNode) || null
  const selectedEdgeObj = diagram.edges.find((edge) => edge.id === selectedEdge) || null
  const preview = useMemo(() => diagramToSvg(diagram, false), [diagram])

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Spinner label="Opening Diagram Studio…" /></div>

  return <div>
    <PageHeader eyebrow="PUBLICATION TOOLS / 02" title="Diagram Studio" description="Build flowcharts and schematics with draggable nodes and labelled connections, then export vector output."
      actions={<>
        <Button variant="secondary" onClick={newDiagramRecord} icon={<Plus size={14} />}>New</Button>
        <Button variant="secondary" onClick={() => { setSaveName(diagram.name); setSaveOpen(true) }} icon={<Save size={14} />}>Save</Button>
        <Button variant="primary" onClick={() => exportDiagram('svg')} disabled={exporting || !diagram.nodes.length} icon={<ArrowDownToLine size={14} />}>Export SVG</Button>
      </>}
    />

    <div className="grid items-start gap-3 xl:grid-cols-[270px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <Card className="p-3.5">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-700 dark:text-slate-200"><Share2 size={14} className="text-blue-500" />Tools</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {SHAPES.map((item) => <Button key={item.shape} size="sm" variant="secondary" onClick={() => addNode(item.shape)} icon={item.icon}>{item.label}</Button>)}
            <Button size="sm" variant={connectMode ? 'primary' : 'secondary'} onClick={() => { setConnectMode((value) => !value); setConnectFrom(null); notify(connectMode ? 'Connection mode off.' : 'Connection mode on: click source, then target.', 'info') }} icon={<Share2 size={12} />}>Connect</Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="ghost" onClick={undo} disabled={!undoStack.length} icon={<Undo2 size={12} />}>Undo</Button>
            <Button size="sm" variant="ghost" onClick={redo} disabled={!redoStack.length} icon={<Redo2 size={12} />}>Redo</Button>
          </div>
          <div className="mt-1 flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-500">Show grid on export</span><Toggle label="" checked={showGrid} onChange={setShowGrid} /></div>
          {connectMode && <Callout tone="info">{connectFrom ? 'Click the target node to finish the connection.' : 'Click the source node first, then the target.'}</Callout>}
        </Card>

        {selected && <Card className="p-3.5">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Node</h2>
            <div className="flex gap-1">
              <button type="button" aria-label="Duplicate node" onClick={() => duplicateNode(selected.id)} className="text-slate-400 hover:text-blue-500"><Copy size={13} /></button>
              <button type="button" aria-label="Delete node" onClick={deleteSelection} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          </div>
          <Field label="Text"><textarea rows={3} value={selected.text} onChange={(event) => updateNode(selected.id, { text: event.target.value }, false)} className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></Field>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Field label="X"><Input type="number" value={Math.round(selected.x)} onChange={(event) => updateNode(selected.id, { x: Number(event.target.value) || 0 })} /></Field>
            <Field label="Y"><Input type="number" value={Math.round(selected.y)} onChange={(event) => updateNode(selected.id, { y: Number(event.target.value) || 0 })} /></Field>
            <Field label="Width"><Input type="number" value={Math.round(selected.width)} onChange={(event) => updateNode(selected.id, { width: Math.max(20, Number(event.target.value) || 20) })} /></Field>
            <Field label="Height"><Input type="number" value={Math.round(selected.height)} onChange={(event) => updateNode(selected.id, { height: Math.max(20, Number(event.target.value) || 20) })} /></Field>
            <Field label="Fill"><input type="color" value={selected.fill} onChange={(event) => updateNode(selected.id, { fill: event.target.value }, false)} aria-label="Node fill" className="h-9 w-full rounded border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></Field>
            <Field label="Stroke"><input type="color" value={selected.stroke} onChange={(event) => updateNode(selected.id, { stroke: event.target.value }, false)} aria-label="Node stroke" className="h-9 w-full rounded border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></Field>
            <Field label="Text colour"><input type="color" value={selected.textColor} onChange={(event) => updateNode(selected.id, { textColor: event.target.value }, false)} aria-label="Node text colour" className="h-9 w-full rounded border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></Field>
            <Field label="Font size"><Input type="number" min={8} max={48} value={selected.fontSize} onChange={(event) => updateNode(selected.id, { fontSize: Math.max(8, Number(event.target.value) || 14) })} /></Field>
          </div>
        </Card>}

        {selectedEdgeObj && <Card className="p-3.5">
          <h2 className="mb-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">Connection</h2>
          <Field label="Label"><Input value={selectedEdgeObj.label || ''} onChange={(event) => updateEdge(selectedEdgeObj.id, { label: event.target.value }, false)} /></Field>
          <div className="mt-2 flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-500">Dashed line</span><Toggle label="" checked={Boolean(selectedEdgeObj.dashed)} onChange={(value) => updateEdge(selectedEdgeObj.id, { dashed: value })} /></div>
          <div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-500">Arrowhead</span><Toggle label="" checked={selectedEdgeObj.arrow !== false} onChange={(value) => updateEdge(selectedEdgeObj.id, { arrow: value })} /></div>
          <Button size="sm" variant="danger" className="mt-2 w-full" onClick={deleteSelection} icon={<Trash2 size={12} />}>Delete connection</Button>
        </Card>}

        <Card className="p-3.5">
          <h2 className="mb-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">Saved diagrams</h2>
          <div className="max-h-52 space-y-1 overflow-auto">
            {diagrams.map((record) => <div key={record.id} className="flex items-center gap-1 rounded border border-slate-100 p-1.5 dark:border-slate-800">
              <button type="button" onClick={() => openDiagram(record)} className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-300">{record.name}</button>
              <span className="text-[9px] text-slate-400">{record.nodes?.length || 0}n</span>
              <button type="button" aria-label={`Delete ${record.name}`} onClick={() => deleteDiagram(record.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
            </div>)}
            {!diagrams.length && <p className="text-[10px] text-slate-400">No saved diagrams yet.</p>}
          </div>
        </Card>
      </aside>

      <div className="min-w-0 space-y-3">
        <Card className="p-3.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div><Badge tone="green">VECTOR CANVAS</Badge><p className="mt-1 text-[10px] text-slate-500">{pluralize(diagram.nodes.length, 'node')} · {pluralize(diagram.edges.length, 'connection')} · {dirty ? 'unsaved changes' : 'saved state'}</p></div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => exportDiagram('png')}>PNG</Button>
              <Button size="sm" variant="secondary" onClick={() => exportDiagram('pdf')}>PDF</Button>
              <Button size="sm" variant="secondary" onClick={() => downloadText(preview, `${slugify(diagram.name || 'diagram')}.svg`, 'image/svg+xml')} icon={<Download size={12} />}>SVG</Button>
            </div>
          </div>
          <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-950">
            <svg ref={svgRef} width="100%" style={{ maxHeight: '70vh', aspectRatio: `${WIDTH} / ${HEIGHT}` }} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className={`mx-auto block rounded bg-white shadow-sm ${connectMode ? 'cursor-crosshair' : ''}`} role="img" aria-label="Diagram canvas"
              onPointerMove={onPointerMove} onPointerUp={() => { dragRef.current = null }} onPointerLeave={() => { dragRef.current = null }}
              onClick={(event) => { if (event.target === svgRef.current) { setSelectedNode(null); setSelectedEdge(null) } }}>
              <rect width={WIDTH} height={HEIGHT} fill="#ffffff" />
              {showGrid && <g pointerEvents="none">
                {Array.from({ length: Math.floor(WIDTH / 40) + 1 }, (_, i) => <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={HEIGHT} stroke="#eef2f7" />)}
                {Array.from({ length: Math.floor(HEIGHT / 40) + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 40} x2={WIDTH} y2={i * 40} stroke="#eef2f7" />)}
              </g>}
              <defs><marker id="arrow-live" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" /></marker></defs>
              {diagram.edges.map((edge) => {
                const points = edgePoints(edge, diagram.nodes)
                if (!points) return null
                const active = edge.id === selectedEdge
                return <g key={edge.id} onClick={(event) => { event.stopPropagation(); setSelectedEdge(edge.id); setSelectedNode(null) }} className="cursor-pointer">
                  <line x1={points.start.x} y1={points.start.y} x2={points.end.x} y2={points.end.y} stroke="transparent" strokeWidth={14} />
                  <line x1={points.start.x} y1={points.start.y} x2={points.end.x} y2={points.end.y} stroke={active ? '#3779f6' : '#475569'} strokeWidth={active ? 3 : 2} strokeDasharray={edge.dashed ? '8 5' : undefined} markerEnd={edge.arrow === false ? undefined : 'url(#arrow-live)'} />
                  {edge.label && <>
                    <rect x={points.mid.x - Math.max(20, edge.label.length * 3.6 + 6)} y={points.mid.y - 11} width={Math.max(40, edge.label.length * 7.2 + 12)} height={20} rx={4} fill="#ffffff" opacity={0.94} />
                    <text x={points.mid.x} y={points.mid.y + 3} textAnchor="middle" fontSize={12} fill="#475569">{edge.label}</text>
                  </>}
                </g>
              })}
              {diagram.nodes.map((node) => {
                const isSelected = node.id === selectedNode
                return <g key={node.id} onPointerDown={(event) => startDrag(event, node)} onClick={(event) => { event.stopPropagation(); selectNode(node) }} className={connectMode ? 'cursor-crosshair' : 'cursor-move'}>
                  {node.shape === 'circle'
                    ? <ellipse cx={node.x + node.width / 2} cy={node.y + node.height / 2} rx={node.width / 2} ry={node.height / 2} fill={node.fill} stroke={connectFrom === node.id ? '#f59e0b' : node.stroke} strokeWidth={connectFrom === node.id ? 4 : 2} />
                    : node.shape === 'diamond'
                      ? <polygon points={`${node.x + node.width / 2},${node.y} ${node.x + node.width},${node.y + node.height / 2} ${node.x + node.width / 2},${node.y + node.height} ${node.x},${node.y + node.height / 2}`} fill={node.fill} stroke={connectFrom === node.id ? '#f59e0b' : node.stroke} strokeWidth={connectFrom === node.id ? 4 : 2} />
                      : <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.shape === 'rounded' ? 18 : node.shape === 'text' ? 0 : 4} fill={node.fill} stroke={node.shape === 'text' ? 'none' : connectFrom === node.id ? '#f59e0b' : node.stroke} strokeWidth={connectFrom === node.id ? 4 : 2} />}
                  {(() => {
                    const lines = wrapText(node.text, Math.max(8, Math.floor(node.width / Math.max(7, node.fontSize * 0.58))))
                    const lineHeight = node.fontSize * 1.25
                    const startY = node.y + node.height / 2 - ((lines.length - 1) * lineHeight) / 2 + node.fontSize * 0.35
                    return <text x={node.x + node.width / 2} y={startY} textAnchor="middle" fontSize={node.fontSize} fill={node.textColor} pointerEvents="none">
                      {lines.map((line, index) => <tspan key={index} x={node.x + node.width / 2} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>)}
                    </text>
                  })()}
                  {isSelected && <rect x={node.x - 4} y={node.y - 4} width={node.width + 8} height={node.height + 8} fill="none" stroke="#3779f6" strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />}
                </g>
              })}
              {!diagram.nodes.length && <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" fontSize={18} fill="#94a3b8">Add nodes from the toolbar to begin</text>}
            </svg>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Drag nodes to reposition. In Connect mode, click source then target. Select a line to edit its label, dash and arrowhead.</p>
        </Card>
      </div>
    </div>

    <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save diagram"
      footer={<><Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save locally</Button></>}>
      <Field label="Diagram name"><Input value={saveName} onChange={(event) => setSaveName(event.target.value)} autoFocus /></Field>
      <div className="mt-2 flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-500">Include grid in SVG/PNG/PDF exports</span><Toggle label="" checked={showGrid} onChange={setShowGrid} /></div>
    </Modal>
  </div>
}
