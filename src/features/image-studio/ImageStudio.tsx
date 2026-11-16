import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Crop, Image as ImageIcon, Redo2, RotateCcw, RotateCw, Undo2, Upload } from 'lucide-react'
import { Badge, Button, Callout, Card, Field, Input, PageHeader, Select, Toggle } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { canvasToBlob, downloadBlob, readFileAsDataURL } from '../../lib/export.js'
import { loadImageElement } from '../../lib/tracing.js'

type Adjust = { brightness: number; contrast: number; grayscale: boolean; width: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The image could not be decoded.'))
    image.src = src
  })
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function ImageStudio() {
  const { notify } = useApp()
  const [original, setOriginal] = useState('')
  const [base, setBase] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [grayscale, setGrayscale] = useState(false)
  const [width, setWidth] = useState(0)
  const [format, setFormat] = useState<'image/png' | 'image/jpeg'>('image/png')
  const [quality, setQuality] = useState('0.92')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [undoStack, setUndoStack] = useState<{ base: string; adjust: Adjust }[]>([])
  const [redoStack, setRedoStack] = useState<{ base: string; adjust: Adjust }[]>([])
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(100)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const beforeRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef(base)
  baseRef.current = base
  const adjustRef = useRef<Adjust>({ brightness, contrast, grayscale, width })
  adjustRef.current = { brightness, contrast, grayscale, width }

  const adjust = useMemo<Adjust>(() => ({ brightness, contrast, grayscale, width }), [brightness, contrast, grayscale, width])
  const dirty = !!original && (base !== original || brightness !== 100 || contrast !== 100 || grayscale || format !== 'image/png')

  const pushHistory = (nextBase: string, nextAdjust: Adjust) => {
    setUndoStack((stack) => [...stack.slice(-24), { base: baseRef.current, adjust: adjustRef.current }])
    setRedoStack([])
    setBase(nextBase)
    setBrightness(nextAdjust.brightness)
    setContrast(nextAdjust.contrast)
    setGrayscale(nextAdjust.grayscale)
    setWidth(nextAdjust.width)
  }

  const undo = () => {
    if (!undoStack.length) return
    const previous = undoStack[undoStack.length - 1]
    setRedoStack((stack) => [...stack, { base: baseRef.current, adjust: adjustRef.current }])
    setUndoStack(undoStack.slice(0, -1))
    setBase(previous.base)
    setBrightness(previous.adjust.brightness)
    setContrast(previous.adjust.contrast)
    setGrayscale(previous.adjust.grayscale)
    setWidth(previous.adjust.width)
  }

  const redo = () => {
    if (!redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((stack) => [...stack, { base: baseRef.current, adjust: adjustRef.current }])
    setRedoStack(redoStack.slice(0, -1))
    setBase(next.base)
    setBrightness(next.adjust.brightness)
    setContrast(next.adjust.contrast)
    setGrayscale(next.adjust.grayscale)
    setWidth(next.adjust.width)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    if (!base) return
    let cancelled = false
    ;(async () => {
      const image = await loadImage(base)
      if (cancelled) return
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight })
      if (!width) setWidth(image.naturalWidth)
      setCrop({ x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight })
      const canvas = previewRef.current
      if (canvas) {
        const maxWidth = Math.min(820, canvas.parentElement?.clientWidth || 820)
        const scale = Math.min(1, maxWidth / image.naturalWidth)
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d')
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height)
          context.filter = `brightness(${brightness}%) contrast(${contrast}%) ${grayscale ? 'grayscale(1)' : ''}`
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
        }
      }
      const beforeCanvas = beforeRef.current
      if (beforeCanvas && original) {
        const originalImage = await loadImage(original)
        const scale = Math.min(1, Math.min(420, beforeCanvas.parentElement?.clientWidth || 420) / originalImage.naturalWidth)
        beforeCanvas.width = Math.max(1, Math.round(originalImage.naturalWidth * scale))
        beforeCanvas.height = Math.max(1, Math.round(originalImage.naturalHeight * scale))
        beforeCanvas.getContext('2d')?.drawImage(originalImage, 0, 0, beforeCanvas.width, beforeCanvas.height)
      }
    })().catch((error) => notify(error instanceof Error ? error.message : 'Preview failed.', 'error'))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, brightness, contrast, grayscale, original])

  const openImage = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { notify('Choose a PNG, JPEG, WebP or GIF image.', 'warning'); return }
    setLoading(true)
    try {
      const dataUrl = await readFileAsDataURL(file)
      const image = await loadImage(dataUrl)
      setOriginal(dataUrl)
      setBase(dataUrl)
      setFileName(file.name)
      setFileSize(file.size)
      setBrightness(100)
      setContrast(100)
      setGrayscale(false)
      setWidth(image.naturalWidth)
      setUndoStack([])
      setRedoStack([])
      setZoom(100)
      setFormat(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png')
      notify(`Opened ${file.name} (${image.naturalWidth}×${image.naturalHeight}). The original file is untouched.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The image could not be opened.', 'error')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const applyCrop = async () => {
    if (!base) return
    const image = await loadImage(base)
    const x = Math.max(0, Math.min(image.naturalWidth - 1, Math.floor(Number(crop.x) || 0)))
    const y = Math.max(0, Math.min(image.naturalHeight - 1, Math.floor(Number(crop.y) || 0)))
    const w = Math.max(1, Math.min(image.naturalWidth - x, Math.floor(Number(crop.width) || image.naturalWidth)))
    const h = Math.max(1, Math.min(image.naturalHeight - y, Math.floor(Number(crop.height) || image.naturalHeight)))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(image, x, y, w, h, 0, 0, w, h)
    const next = canvas.toDataURL('image/png')
    pushHistory(next, { ...adjust, width: w })
    notify(`Cropped to ${w}×${h} px.`, 'success')
  }

  const rotate = async (degrees: 90 | 270) => {
    if (!base) return
    const image = await loadImage(base)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalHeight
    canvas.height = image.naturalWidth
    const context = canvas.getContext('2d')
    if (!context) return
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate((degrees * Math.PI) / 180)
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
    const next = canvas.toDataURL('image/png')
    pushHistory(next, { ...adjust, width: canvas.width })
    notify(`Rotated ${degrees}°.`, 'success')
  }

  const reset = () => {
    if (!original) return
    pushHistory(original, { brightness: 100, contrast: 100, grayscale: false, width: 0 })
    setFormat('image/png')
    notify('Adjustments and transforms reset to the original image.', 'info')
  }

  const exportImage = async () => {
    if (!base) { notify('Open an image first.', 'warning'); return }
    setExporting(true)
    try {
      const image = await loadImage(base)
      const outputWidth = Math.max(1, Math.min(12000, Math.round(Number(width) || image.naturalWidth)))
      const outputHeight = Math.max(1, Math.round(outputWidth * (image.naturalHeight / image.naturalWidth)))
      if (outputWidth * outputHeight > 80_000_000) throw new Error('Output resolution is too large. Reduce the width.')
      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = outputHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is not available.')
      if (format === 'image/jpeg') {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, outputWidth, outputHeight)
      }
      context.filter = `brightness(${brightness}%) contrast(${contrast}%) ${grayscale ? 'grayscale(1)' : ''}`
      context.drawImage(image, 0, 0, outputWidth, outputHeight)
      const blob = await canvasToBlob(canvas, format, Number(quality) || 0.92)
      const extension = format === 'image/jpeg' ? 'jpg' : 'png'
      const name = fileName ? fileName.replace(/\.[^.]+$/, '') : 'sciveyra-image'
      downloadBlob(blob, `${name}-edited.${extension}`)
      notify(`Exported ${extension.toUpperCase()} at ${outputWidth}×${outputHeight} (${formatBytes(blob.size)}). Original unchanged.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export failed.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return <div>
    <PageHeader eyebrow="VISUAL TOOLS / 01" title="Image Studio" description="Crop, rotate, resize and adjust images locally — the source file is never modified."
      actions={<>
        <Button variant="secondary" onClick={() => inputRef.current?.click()} icon={<Upload size={14} />}>Open image</Button>
        <Button variant="primary" onClick={exportImage} disabled={!base || exporting} icon={<ArrowDownToLine size={14} />}>{exporting ? 'Exporting…' : 'Export image'}</Button>
      </>}
    />
    <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => openImage(event.target.files?.[0])} aria-label="Open image file" />

    <div className="grid items-start gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <Card className="p-3.5">
          <h2 className="mb-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">Adjustments</h2>
          <label htmlFor="image-brightness" className="flex justify-between text-[10px] font-bold uppercase text-slate-500">Brightness <span>{brightness}%</span></label>
          <input id="image-brightness" type="range" min={20} max={200} value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} className="w-full accent-blue-500" />
          <label htmlFor="image-contrast" className="mt-2 flex justify-between text-[10px] font-bold uppercase text-slate-500">Contrast <span>{contrast}%</span></label>
          <input id="image-contrast" type="range" min={20} max={200} value={contrast} onChange={(event) => setContrast(Number(event.target.value))} className="w-full accent-blue-500" />
          <Toggle label="Grayscale" checked={grayscale} onChange={setGrayscale} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Output width (px)"><Input type="number" min={1} max={12000} value={width || ''} onChange={(event) => setWidth(Number(event.target.value) || 0)} /></Field>
            <Field label="Zoom"><Select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}><option value={50}>50%</option><option value={75}>75%</option><option value={100}>100%</option><option value={150}>150%</option></Select></Field>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" onClick={undo} disabled={!undoStack.length} icon={<Undo2 size={12} />}>Undo</Button>
            <Button size="sm" variant="ghost" onClick={redo} disabled={!redoStack.length} icon={<Redo2 size={12} />}>Redo</Button>
            <Button size="sm" variant="ghost" onClick={reset} disabled={!original} icon={<RotateCcw size={12} />}>Reset</Button>
          </div>
        </Card>

        <Card className="p-3.5">
          <h2 className="mb-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">Transform</h2>
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => rotate(270)} disabled={!base} icon={<RotateCw size={12} className="-scale-x-100" />}>Left</Button>
            <Button size="sm" variant="secondary" onClick={() => rotate(90)} disabled={!base} icon={<RotateCw size={12} />}>Right</Button>
          </div>
          <div className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Crop region (pixels)</div>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <Field label="X"><Input type="number" min={0} value={crop.x} onChange={(event) => setCrop({ ...crop, x: Number(event.target.value) || 0 })} /></Field>
            <Field label="Y"><Input type="number" min={0} value={crop.y} onChange={(event) => setCrop({ ...crop, y: Number(event.target.value) || 0 })} /></Field>
            <Field label="Width"><Input type="number" min={1} value={crop.width} onChange={(event) => setCrop({ ...crop, width: Number(event.target.value) || 1 })} /></Field>
            <Field label="Height"><Input type="number" min={1} value={crop.height} onChange={(event) => setCrop({ ...crop, height: Number(event.target.value) || 1 })} /></Field>
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={applyCrop} disabled={!base} icon={<Crop size={12} />}>Apply crop</Button>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Cropping and rotation update the working copy. Use Reset to return to the original.</p>
        </Card>

        <Card className="p-3.5">
          <h2 className="mb-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">Export</h2>
          <Field label="Format"><Select value={format} onChange={(event) => setFormat(event.target.value as 'image/png' | 'image/jpeg')}><option value="image/png">PNG (supports transparency)</option><option value="image/jpeg">JPEG (white background)</option></Select></Field>
          {format === 'image/jpeg' && <Field label="JPEG quality" className="mt-2"><Input type="number" min={0.1} max={1} step={0.05} value={quality} onChange={(event) => setQuality(event.target.value)} /></Field>}
          <p className="mt-2 text-[10px] text-slate-400">Estimated output: {width || dimensions.width} × {width && dimensions.width ? Math.round(width * dimensions.height / dimensions.width) : dimensions.height} px</p>
        </Card>
      </aside>

      <div className="min-w-0 space-y-3">
        {!base ? <Card className="grid min-h-[420px] place-items-center p-6">
          <button type="button" onClick={() => inputRef.current?.click()} className="flex max-w-sm flex-col items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-8 py-12 text-center transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-900/40">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"><ImageIcon size={28} /></span>
            <span className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">Open a scientific image</span>
            <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">PNG, JPEG, WebP or GIF. Processing stays in your browser.</span>
          </button>
        </Card> : <>
          <Card className="p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <Badge tone={dirty ? 'amber' : 'green'}>{dirty ? 'EDITED COPY' : 'ORIGINAL'}</Badge>
                <h2 className="mt-1 truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">{fileName}</h2>
                <p className="text-[10px] text-slate-500">Edited dimensions {dimensions.width}×{dimensions.height} px · source {dimensions.width}×{dimensions.height} · {formatBytes(fileSize)}</p>
              </div>
              <span className="text-[10px] text-slate-400">Preview zoom {zoom}%</span>
            </div>
            <div className="overflow-auto rounded-lg border border-slate-100 bg-[repeating-conic-gradient(#f1f4f8_0_25%,#fafbfe_0_50%)] bg-[length:20px_20px] p-3 dark:border-slate-800 dark:bg-slate-950">
              <canvas ref={previewRef} style={{ width: `${zoom}%`, maxWidth: '100%', height: 'auto' }} className="mx-auto block rounded" aria-label="Edited image preview" />
            </div>
          </Card>
          <Card className="p-3.5">
            <h2 className="mb-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">Before / after</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <figure className="m-0"><figcaption className="mb-1 text-[10px] font-bold uppercase text-slate-400">Original</figcaption><div className="rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950"><canvas ref={beforeRef} className="mx-auto block max-w-full rounded" aria-label="Original image" /></div></figure>
              <figure className="m-0"><figcaption className="mb-1 text-[10px] font-bold uppercase text-slate-400">Edited</figcaption><div className="rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950"><img src={base} alt="Edited preview" style={{ filter: `brightness(${brightness}%) contrast(${contrast}%) ${grayscale ? 'grayscale(1)' : ''}`, maxWidth: '100%' }} className="mx-auto block rounded" /></div></figure>
            </div>
          </Card>
          <Callout tone="info">Adjustments are applied only to the exported copy. Scientific images should not be edited in ways that misrepresent the underlying data; retain the original and record applied transformations in your methods.</Callout>
        </>}
      </div>
    </div>
  </div>
}
