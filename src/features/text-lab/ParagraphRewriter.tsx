import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine, Check, Copy, FileText, Loader2, Save, ShieldCheck, Sparkles,
  WandSparkles
} from 'lucide-react'
import { Badge, Button, Callout, Card, Field, Input, PageHeader, Select, Tabs } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { dbPut, getSetting, setSetting } from '../../lib/storage.js'
import { copyText, downloadText } from '../../lib/export.js'
import { nowIso, uid } from '../../lib/util.js'
import {
  analyzeParagraph, DEFAULT_OLLAMA_ENDPOINT, DEFAULT_OLLAMA_MODEL, normalizeEndpoint,
  REWRITE_PRESETS, rewriteParagraph, rewriteWithOllama, summarizeChanges
} from '../../lib/rewriter.js'
import type { DraftRecord } from '../../types'

type PresetId = 'natural' | 'academic' | 'concise'
type Engine = 'local' | 'ollama'

const EXAMPLE = `It is important to note that the catalyst was used by the researchers in order to improve the reaction rate. The results show that a number of conditions are able to change the observed product distribution.`

export default function ParagraphRewriter() {
  const { notify, bumpRefresh } = useApp()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [preset, setPreset] = useState<PresetId>('natural')
  const [engine, setEngine] = useState<Engine>('local')
  const [endpoint, setEndpoint] = useState(DEFAULT_OLLAMA_ENDPOINT)
  const [model, setModel] = useState(DEFAULT_OLLAMA_MODEL)
  const [busy, setBusy] = useState(false)
  const [lastRun, setLastRun] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [storedEndpoint, storedModel] = await Promise.all([
          getSetting('ollamaEndpoint', DEFAULT_OLLAMA_ENDPOINT) as Promise<string>,
          getSetting('ollamaModel', DEFAULT_OLLAMA_MODEL) as Promise<string>
        ])
        if (storedEndpoint) setEndpoint(storedEndpoint)
        if (storedModel) setModel(storedModel)
      } catch {
        /* browser storage may be unavailable; settings remain in memory */
      }
    })()
  }, [])

  const before = useMemo(() => analyzeParagraph(input), [input])
  const after = useMemo(() => analyzeParagraph(output), [output])
  const changes = useMemo(() => summarizeChanges(input, output), [input, output])
  const selectedPreset = REWRITE_PRESETS.find((entry) => entry.id === preset) || REWRITE_PRESETS[0]

  const runLocal = () => {
    if (!input.trim()) { notify('Paste or type a paragraph first.', 'warning'); return }
    setBusy(true)
    try {
      const rewritten = rewriteParagraph(input, { preset })
      setOutput(rewritten)
      setLastRun(`Local · ${selectedPreset.label}`)
      notify(rewritten === input.trim() ? 'No local rule changes were needed for this paragraph.' : 'Paragraph rewritten locally.', 'success')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'The local rewrite failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const runOllama = async () => {
    if (!input.trim()) { notify('Paste or type a paragraph first.', 'warning'); return }
    setBusy(true)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90000)
    try {
      const cleanEndpoint = normalizeEndpoint(endpoint)
      const rewritten = await rewriteWithOllama(input, { endpoint: cleanEndpoint, model, preset, signal: controller.signal })
      setOutput(rewritten)
      setEndpoint(cleanEndpoint)
      await setSetting('ollamaEndpoint', cleanEndpoint).catch(() => {})
      await setSetting('ollamaModel', model).catch(() => {})
      setLastRun(`Ollama · ${model || DEFAULT_OLLAMA_MODEL}`)
      notify('Rewrite received from your self-hosted Ollama model. Review it before use.', 'success')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The Ollama request failed.'
      notify(`${message} Local rewriting remains available.`, 'error')
    } finally {
      clearTimeout(timer)
      setBusy(false)
    }
  }

  const copyOutput = async () => {
    if (!output) { notify('There is no rewritten text to copy.', 'warning'); return }
    try {
      await copyText(output)
      notify('Rewritten paragraph copied.', 'success')
    } catch {
      notify('Clipboard access was blocked by the browser.', 'error')
    }
  }

  const saveDraft = async () => {
    if (!output.trim()) { notify('There is no rewritten text to save.', 'warning'); return }
    try {
      const record: DraftRecord = {
        id: uid('draft'),
        title: `Rewritten paragraph · ${new Date().toLocaleDateString()}`,
        content: output,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await dbPut('drafts', record)
      bumpRefresh()
      notify('Saved as a draft in Writing Lab.', 'success')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'The draft could not be saved.', 'error')
    }
  }

  const metric = (label: string, value: string | number) => <div key={label} className="glass-subtle rounded-xl border-slate-200/70 px-3 py-2">
    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</div>
    <div className="mt-0.5 text-sm font-extrabold text-slate-700">{value}</div>
  </div>

  return <div>
    <PageHeader eyebrow="TEXT LAB / PARAGRAPH REWRITER" title="Paragraph Rewriter" description="Clarify and humanise scientific prose locally. Numbers, units, DOIs and citations are protected; every rewrite stays under your review."
      actions={<>
        <Badge tone="green"><ShieldCheck size={11} /> No paid AI API</Badge>
        <Button variant="secondary" onClick={() => { setInput(EXAMPLE); setOutput('') }} icon={<FileText size={14} />}>Load example</Button>
      </>}
    />

    <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {metric('Original words', before.wordCount)}
      {metric('Rewritten words', output ? after.wordCount : '—')}
      {metric('Fillers flagged', before.fillerCount)}
      {metric('Readability', output ? after.readability : before.readability)}
    </div>

    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><WandSparkles size={15} className="text-violet-500" /> Rewrite workspace</h2>
            <Tabs tabs={[{ id: 'local', label: 'Local rules' }, { id: 'ollama', label: 'Self-hosted Ollama' }]} value={engine} onChange={(value) => setEngine(value as Engine)} />
          </div>

          <Field label="Original paragraph" hint="Paste one paragraph from your manuscript. Protected items (numbers, units, DOIs, URLs, citations) are not changed by local rules.">
            <textarea value={input} onChange={(event) => { setInput(event.target.value); setOutput(''); setLastRun('') }} rows={9}
              placeholder="Paste a paragraph here…"
              aria-label="Original paragraph"
              className="w-full resize-y rounded-xl border border-slate-200/80 bg-white/80 px-3 py-3 text-[12.5px] leading-relaxed text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,.03)] outline-none backdrop-blur-sm transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
          </Field>

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field label="Writing style" hint={selectedPreset.description}>
              <Select value={preset} onChange={(event) => setPreset(event.target.value as PresetId)}>
                {REWRITE_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </Select>
            </Field>
            <Button variant="primary" disabled={busy || !input.trim()} onClick={engine === 'local' ? runLocal : runOllama} icon={busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>
              {busy ? 'Rewriting…' : engine === 'local' ? 'Rewrite locally' : 'Rewrite with Ollama'}
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Rewritten paragraph</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">{lastRun || 'Run a rewrite to see the result here'} · always verify against the source</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" disabled={!output} onClick={copyOutput} icon={<Copy size={12} />}>Copy</Button>
              <Button size="sm" variant="secondary" disabled={!output} onClick={() => { downloadText(output, 'sciveyra-rewritten-paragraph.txt'); notify('Rewritten paragraph downloaded.', 'success') }} icon={<ArrowDownToLine size={12} />}>Download</Button>
              <Button size="sm" variant="secondary" disabled={!output} onClick={saveDraft} icon={<Save size={12} />}>Save to drafts</Button>
            </div>
          </div>
          <textarea value={output} onChange={(event) => setOutput(event.target.value)} rows={9}
            placeholder="The rewritten paragraph appears here and can be edited directly…"
            aria-label="Rewritten paragraph"
            className="w-full resize-y rounded-xl border border-blue-100 bg-blue-50/20 px-3 py-3 text-[12.5px] leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10" />
          {output && <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="slate">{changes.beforeWords} → {changes.afterWords} words</Badge>
            <Badge tone={changes.wordDelta <= 0 ? 'green' : 'slate'}>{changes.wordDelta > 0 ? '+' : ''}{changes.wordDelta} words</Badge>
            <Badge tone="green">{changes.fillersRemoved} filler(s) removed</Badge>
            <Badge tone="blue">{changes.passiveReduction} passive form(s) reduced</Badge>
          </div>}
        </Card>
      </div>

      <aside className="space-y-3">
        <Card className="p-4">
          <h2 className="text-sm font-extrabold text-slate-800">What local rewriting does</h2>
          <ul className="mt-2 space-y-2 text-[10px] leading-relaxed text-slate-500">
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />Replaces wordy phrases such as “in order to” and “due to the fact that”.</li>
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />Reduces repeated words with a small, conservative synonym set.</li>
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />Converts clear “was … by” constructions into active voice.</li>
            <li className="flex gap-2"><ShieldCheck size={12} className="mt-0.5 shrink-0 text-blue-500" />Protects numbers, units, DOIs, URLs and citation markers.</li>
          </ul>
          <Callout tone="warning">Rule-based rewriting is not a grammar checker or an AI detector. Check every change; scientific meaning is your responsibility.</Callout>
        </Card>

        {engine === 'ollama' && <Card className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><ShieldCheck size={15} className="text-emerald-500" /> Self-hosted model</h2>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Optional. Points to an open-source model you run yourself. No key is sent or stored. Your paragraph is sent only to this endpoint when you click rewrite.</p>
          <div className="mt-3 space-y-2">
            <Field label="Endpoint" hint="Default Ollama address. Stored only in this browser.">
              <Input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={DEFAULT_OLLAMA_ENDPOINT} spellCheck={false} />
            </Field>
            <Field label="Model">
              <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder={DEFAULT_OLLAMA_MODEL} spellCheck={false} />
            </Field>
          </div>
          <Callout tone="info">If the browser blocks localhost requests, start Ollama with <code className="font-mono">OLLAMA_ORIGINS=*</code> or serve this app from an allowed origin. Use a trusted local model.</Callout>
        </Card>}

        <Card className="p-4">
          <h2 className="text-sm font-extrabold text-slate-800">Flags in your original</h2>
          {input.trim() ? <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {metric('Sentences', before.sentenceCount)}
              {metric('Avg words', before.averageWords)}
              {metric('Long sentences', before.longSentenceCount)}
              {metric('Passive forms', before.passiveCount)}
              {metric('Adverbs', before.adverbCount)}
              {metric('Citations', before.citationCount)}
            </div>
            {before.fillers.length > 0 && <div className="mt-3">
              <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400">Fillers</div>
              <div className="flex flex-wrap gap-1">{before.fillers.map((entry: { phrase: string; count: number }) => <Badge key={entry.phrase} tone="amber">{entry.phrase} × {entry.count}</Badge>)}</div>
            </div>}
            {before.repeated.length > 0 && <div className="mt-3">
              <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400">Repeated words</div>
              <div className="flex flex-wrap gap-1">{before.repeated.map((entry: [string, number]) => <Badge key={entry[0]} tone="slate">{entry[0]} × {entry[1]}</Badge>)}</div>
            </div>}
          </> : <p className="mt-2 text-[10.5px] leading-relaxed text-slate-400">Add text to see local flags.</p>}
          <Link to="/writing" className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline">Open Writing Lab <ArrowDownToLine size={11} className="rotate-90" /></Link>
        </Card>
      </aside>
    </div>
  </div>
}
