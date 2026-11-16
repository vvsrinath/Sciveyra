import { useRef, useState } from 'react'
import { ArrowDownToLine, Grid2X2, Image as ImageIcon, Network, Upload, WandSparkles } from 'lucide-react'
import { Badge, Button, Callout, Card, Field, Input, PageHeader, Select, Spinner, Toggle } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { dbPut } from '../../lib/storage.js'
import { TRACE_PRESETS, traceImageToSvg } from '../../lib/tracing.js'
import { downloadText, readFileAsDataURL, svgToPngBlob, downloadBlob } from '../../lib/export.js'
import { nowIso, slugify, uid } from '../../lib/util.js'
import type { Asset } from '../../types'

export default function VectorStudio() {
  const { notify, bumpRefresh } = useApp()
  const [src, setSrc] = useState('')
  const [fileName, setFileName] = useState('')
  const [mode, setMode] = useState<'color' | 'threshold'>('color')
  const [preset, setPreset] = useState('Line art')
  const [threshold, setThreshold] = useState(145)
  const [maxDimension, setMaxDimension] = useState('1200')
  const [simplify, setSimplify] = useState(true)
  const [svg, setSvg] = useState('')
  const [tracing, setTracing] = useState(false)
  const [info, setInfo] = useState<{ width: number; height: number; colors: number } | null>(null)
  const [svgFormat, setSvgFormat] = useState<'svg' | 'png'>('svg')
  const inputRef = useRef<HTMLInputElement>(null)

  const open = async (file?: File) => {
    if (!file) return
    try {
      const dataUrl = await readFileAsDataURL(file)
      setSrc(dataUrl)
      setFileName(file.name)
      setSvg('')
      setInfo(null)
      notify(`Opened ${file.name}. Adjust the settings, then trace.`, 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The image could not be opened.', 'error')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const trace = async () => {
    if (!src) return
    setTracing(true)
    await new Promise((resolve) => setTimeout(resolve, 60))
    try {
      const result = await traceImageToSvg(src, {
        preset,
        threshold,
        mode,
        maxDimension: Math.max(200, Math.min(3000, Number(maxDimension) || 1200)),
        simplify
      })
      setSvg(result.svg)
      setInfo({ width: result.width, height: result.height, colors: result.colors })
      notify(`Vector trace completed at ${result.width}×${result.height}. Review the paths before use.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Tracing failed.', 'error')
    } finally {
      setTracing(false)
    }
  }

  const download = async () => {
    if (!svg) return
    const base = slugify(fileName.replace(/\.[^.]+$/, '') || 'trace')
    if (svgFormat === 'svg') {
      downloadText(svg, `${base}-traced.svg`, 'image/svg+xml;charset=utf-8')
      notify('SVG downloaded.', 'success')
      return
    }
    try {
      const png = await svgToPngBlob(svg, { scale: 2, background: '#ffffff' })
      downloadBlob(png, `${base}-traced.png`)
      notify('PNG rendered from the traced SVG.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'PNG export failed.', 'error')
    }
  }

  const saveAsset = async () => {
    if (!svg) return
    try {
      const asset: Asset = {
        id: uid('asset'),
        name: fileName ? `${fileName} trace` : 'Vector trace',
        kind: 'svg',
        data: svg,
        width: info?.width,
        height: info?.height,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await dbPut('assets', asset)
      bumpRefresh()
      notify('Trace saved as an asset. Open Figure Composer to place it in a figure.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The asset could not be saved.', 'error')
    }
  }

  return <div>
    <PageHeader eyebrow="VISUAL TOOLS / 02" title="Vector Studio" description="Trace high-contrast raster artwork into editable SVG paths using an open-source tracing engine."
      actions={<>
        <Button variant="secondary" onClick={() => inputRef.current?.click()} icon={<Upload size={14} />}>Open image</Button>
        <Button variant="primary" onClick={download} disabled={!svg} icon={<ArrowDownToLine size={14} />}>Download {svgFormat.toUpperCase()}</Button>
      </>}
    />
    <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => open(event.target.files?.[0])} aria-label="Open raster image for tracing" />

    <div className="grid items-start gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <Card className="p-3.5">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-700 dark:text-slate-200"><WandSparkles size={14} className="text-blue-500" />Trace settings</h2>
          <Field label="Tracing engine">
            <Select value={mode} onChange={(event) => setMode(event.target.value as 'color' | 'threshold')}>
              <option value="color">Colour quantisation (ImageTracerJS)</option>
              <option value="threshold">Basic black & white threshold</option>
            </Select>
          </Field>
          <Field label="Preset" className="mt-2"><Select value={preset} onChange={(event) => setPreset(event.target.value)}>{Object.keys(TRACE_PRESETS).map((key) => <option key={key} value={key}>{key}</option>)}</Select></Field>
          {mode === 'threshold' && <>
            <label htmlFor="trace-threshold" className="mt-2 flex justify-between text-[10px] font-bold uppercase text-slate-500">Threshold <span>{threshold}</span></label>
            <input id="trace-threshold" type="range" min={20} max={240} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="w-full accent-blue-500" />
          </>}
          <Field label="Maximum dimension (px)" className="mt-2" hint="Large images are downscaled for responsiveness.">
            <Input type="number" min={200} max={3000} value={maxDimension} onChange={(event) => setMaxDimension(event.target.value)} />
          </Field>
          <Toggle label="Simplify paths" checked={simplify} onChange={setSimplify} />
          <Button className="mt-2 w-full" variant="primary" onClick={trace} disabled={!src || tracing} icon={<WandSparkles size={14} />}>{tracing ? 'Tracing…' : 'Trace to SVG'}</Button>
          {tracing && <div className="mt-2"><Spinner label="Processing pixels and building paths…" /></div>}
          <Callout tone="warning">Tracing is best for line art, logos and simple diagrams. It cannot faithfully reconstruct photographs or continuous-tone microscopy. Review the result before publication.</Callout>
        </Card>

        <Card className="p-3.5">
          <h2 className="mb-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">Output</h2>
          <Field label="Download format"><Select value={svgFormat} onChange={(event) => setSvgFormat(event.target.value as 'svg' | 'png')}><option value="svg">SVG (vector paths)</option><option value="png">PNG (raster preview)</option></Select></Field>
          <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={saveAsset} disabled={!svg} icon={<Grid2X2 size={13} />}>Save to Figure Composer assets</Button>
          {info && <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500"><Badge tone="blue">{info.width}×{info.height}</Badge><Badge tone="slate">up to {info.colors} colours</Badge></div>}
        </Card>
      </aside>

      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <Card className="min-h-[440px] p-3.5">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Original raster</h2>{src && <Badge tone="slate">source</Badge>}</div>
          {src ? <div className="grid min-h-[360px] place-items-center overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950"><img src={src} alt="Original raster" className="max-h-[520px] max-w-full rounded object-contain" /></div>
            : <button type="button" onClick={() => inputRef.current?.click()} className="grid min-h-[360px] w-full place-items-center rounded-lg border-2 border-dashed border-slate-200 text-slate-500 dark:border-slate-700">
              <span className="flex flex-col items-center"><ImageIcon size={30} /><span className="mt-2 text-xs">Choose a suitable image</span></span>
            </button>}
        </Card>
        <Card className="min-h-[440px] p-3.5">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">SVG output</h2>{svg && <Badge tone="green">editable paths</Badge>}</div>
          {svg ? <div className="grid min-h-[360px] place-items-center overflow-auto rounded-lg border border-slate-100 bg-[repeating-conic-gradient(#f1f4f8_0_25%,#ffffff_0_50%)] bg-[length:20px_20px] p-3 dark:border-slate-800 dark:bg-slate-950" dangerouslySetInnerHTML={{ __html: svg }} />
            : <div className="grid min-h-[360px] place-items-center rounded-lg border border-slate-100 bg-slate-50 text-center dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col items-center gap-2 px-6 text-slate-400"><Network size={30} /><p className="max-w-xs text-xs leading-relaxed">Trace a suitable image to preview editable SVG paths here. A real vector engine is used, not a row-by-row threshold hack.</p></div>
            </div>}
        </Card>
      </div>
    </div>
    <div className="mt-3"><Callout tone="info">SVG output is sanitised before preview and export. Embedded raster images inside an imported SVG are not vectorised; only the traced paths are vector geometry.</Callout></div>
  </div>
}
