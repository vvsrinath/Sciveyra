import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine, BookOpen, Check, Copy, FileText, Plus, Save, ShieldCheck, Sparkles, Trash2, TriangleAlert
} from 'lucide-react'
import { Badge, Button, Callout, Card, Field, Input, PageHeader, ProgressBar, Select, Spinner } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { dbDelete, dbGetAll, dbPut } from '../../lib/storage.js'
import { analyzeDraft, readabilityLabel } from '../../lib/writing.js'
import { inlineCitation, formatCitation, CITATION_STYLES } from '../../lib/references.js'
import { copyText, downloadText } from '../../lib/export.js'
import { nowIso, uid } from '../../lib/util.js'
import type { DraftRecord, Reference } from '../../types'

function newDraft(): DraftRecord {
  return { id: uid('draft'), title: 'Untitled draft', content: '', createdAt: nowIso(), updatedAt: nowIso() }
}

export default function WritingLab() {
  const { notify, refreshToken, bumpRefresh, markSaved } = useApp()
  const [drafts, setDrafts] = useState<DraftRecord[]>([])
  const [active, setActive] = useState<DraftRecord | null>(null)
  const [references, setReferences] = useState<Reference[]>([])
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [target, setTarget] = useState('1000')
  const [citationId, setCitationId] = useState('')
  const [citationStyle, setCitationStyle] = useState('APA 7')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeRef = useRef<DraftRecord | null>(null)
  activeRef.current = active

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [draftList, referenceList] = await Promise.all([
          dbGetAll('drafts') as Promise<DraftRecord[]>,
          dbGetAll('references') as Promise<Reference[]>
        ])
        if (cancelled) return
        const sorted = draftList.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        setDrafts(sorted)
        setReferences(referenceList)
        setActive(sorted[0] || null)
        if (referenceList[0]) setCitationId(referenceList[0].id)
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Drafts could not be loaded.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  const createDraft = async () => {
    try {
      const draft = newDraft()
      await dbPut('drafts', draft)
      setDrafts((current) => [draft, ...current])
      setActive(draft)
      setDirty(false)
      bumpRefresh()
      setTimeout(() => textareaRef.current?.focus(), 50)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'A new draft could not be created.', 'error')
    }
  }

  const updateActive = (patch: Partial<DraftRecord>) => {
    setActive((current) => current ? { ...current, ...patch, updatedAt: nowIso() } : current)
    setDirty(true)
  }

  const saveDraft = async (silent = false) => {
    const draft = activeRef.current
    if (!draft) return
    try {
      await dbPut('drafts', draft)
      setDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
      setDirty(false)
      markSaved()
      if (!silent) { bumpRefresh(); notify('Draft saved locally.', 'success') }
    } catch (error) {
      if (!silent) notify(error instanceof Error ? error.message : 'The draft could not be saved.', 'error')
    }
  }

  useEffect(() => {
    if (!dirty || !active) return
    const timer = setTimeout(() => { saveDraft(true) }, 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dirty])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveDraft()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeDraft = async (draft: DraftRecord) => {
    if (!window.confirm(`Delete draft "${draft.title}"? This cannot be undone.`)) return
    try {
      await dbDelete('drafts', draft.id)
      const next = drafts.filter((item) => item.id !== draft.id)
      setDrafts(next)
      if (active?.id === draft.id) { setActive(next[0] || null); setDirty(false) }
      bumpRefresh()
      notify('Draft deleted.', 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The draft could not be deleted.', 'error')
    }
  }

  const exportDraft = (format: 'txt' | 'md') => {
    if (!active) return
    const base = (active.title || 'draft').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    downloadText(active.content, `${base}.${format}`, `text/${format === 'md' ? 'markdown' : 'plain'};charset=utf-8`)
    notify(`Draft exported as ${format.toUpperCase()}.`, 'success')
  }

  const copyDraft = async () => {
    if (!active) return
    try { await copyText(active.content); notify('Draft text copied.', 'success') } catch { notify('Clipboard access failed.', 'error') }
  }

  const insertAtCursor = (insertText: string) => {
    if (!active) return
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? active.content.length
    const end = textarea?.selectionEnd ?? start
    const content = `${active.content.slice(0, start)}${insertText}${active.content.slice(end)}`
    updateActive({ content })
    setTimeout(() => {
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(start + insertText.length, start + insertText.length)
    }, 0)
  }

  const insertCitation = () => {
    const reference = references.find((item) => item.id === citationId)
    if (!reference || !active) { notify('Save a reference first, then insert a citation.', 'warning'); return }
    const index = references.findIndex((item) => item.id === reference.id) + 1
    insertAtCursor(inlineCitation(reference, index, citationStyle))
    notify(`In-text citation inserted (${citationStyle}). Check the rendered reference list before submission.`, 'info')
  }

  const insertReferenceEntry = () => {
    const reference = references.find((item) => item.id === citationId)
    if (!reference || !active) { notify('Save a reference first, then insert a bibliography entry.', 'warning'); return }
    const index = references.findIndex((item) => item.id === reference.id) + 1
    insertAtCursor(formatCitation(reference, citationStyle, index))
    notify(`Bibliography entry inserted (${citationStyle}).`, 'success')
  }

  const insertBibliography = () => {
    if (!active) return
    if (!references.length) { notify('Add references first to build a bibliography.', 'warning'); return }
    const entries = references.map((reference, index) => formatCitation(reference, citationStyle, index + 1))
    insertAtCursor(`\n\nReferences (${citationStyle})\n${entries.map((entry) => `- ${entry}`).join('\n')}`)
    notify(`Bibliography with ${references.length} reference(s) inserted.`, 'success')
  }

  const stats = useMemo(() => analyzeDraft(active?.content || ''), [active?.content])
  const targetNumber = Math.max(1, Number(target) || 1000)
  const longSentenceList = stats.longSentences.slice(0, 4)

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Spinner label="Opening Writing Lab…" /></div>

  return <div>
    <PageHeader eyebrow="WRITING / 01" title="Writing Lab" description="Draft in plain text with local, rule-based checks — no AI service and no detector claims."
      actions={<>
        <Button variant="secondary" onClick={() => exportDraft('txt')} disabled={!active} icon={<ArrowDownToLine size={14} />}>Export text</Button>
        <Button variant="primary" onClick={() => saveDraft()} disabled={!active || !dirty} icon={<Save size={14} />}>{dirty ? 'Save draft' : 'Saved'}</Button>
      </>}
    />

    <div className="grid items-start gap-3 xl:grid-cols-[220px_minmax(0,1fr)_290px]">
      <aside className="space-y-2">
        <Card className="p-2.5">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Drafts</h2><Badge tone="slate">{drafts.length}</Badge></div>
          <div className="max-h-[430px] space-y-1 overflow-auto">
            {drafts.map((draft) => <div key={draft.id} className={`group flex items-center gap-1 rounded-md border p-1.5 ${active?.id === draft.id ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40' : 'border-slate-100 dark:border-slate-800'}`}>
              <button type="button" onClick={() => { setActive(draft); setDirty(false) }} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[10px] font-bold text-slate-700 dark:text-slate-200">{draft.title || 'Untitled draft'}</span>
                <span className="mt-0.5 block text-[9px] text-slate-400">{new Date(draft.updatedAt).toLocaleDateString()}</span>
              </button>
              <button type="button" onClick={() => removeDraft(draft)} aria-label={`Delete ${draft.title}`} className="text-slate-300 hover:text-red-500"><Trash2 size={11} /></button>
            </div>)}
            {!drafts.length && <p className="px-1 py-2 text-[10px] text-slate-400">No drafts yet.</p>}
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={createDraft} icon={<Plus size={12} />}>New draft</Button>
        </Card>

        <Card className="p-3">
          <h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Word target</h2>
          <div className="mt-2 flex items-center gap-1.5"><Input type="number" min={1} value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Word target" /><span className="text-[10px] text-slate-400">words</span></div>
          <ProgressBar value={Math.min(100, (stats.wordCount / targetNumber) * 100)} />
          <p className="mt-1 text-[9.5px] text-slate-400">{stats.wordCount.toLocaleString()} / {targetNumber.toLocaleString()} words</p>
        </Card>

        <Card className="p-3">
          <h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200"><BookOpen size={13} className="text-blue-500" />Insert citation</h2>
          {references.length ? <>
            <Field label="Saved reference" className="mt-1"><Select value={citationId} onChange={(event) => setCitationId(event.target.value)}>{references.map((reference) => <option key={reference.id} value={reference.id}>{reference.title.slice(0, 70)}</option>)}</Select></Field>
            <Field label="Citation style" className="mt-1.5"><Select value={citationStyle} onChange={(event) => setCitationStyle(event.target.value)}>{CITATION_STYLES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Button size="sm" className="mt-1.5 w-full" onClick={insertCitation} icon={<Plus size={12} />}>Insert in-text citation</Button>
            <Button size="sm" variant="secondary" className="mt-1.5 w-full" onClick={insertReferenceEntry} icon={<Plus size={12} />}>Insert bibliography entry</Button>
            <Button size="sm" variant="ghost" className="mt-1.5 w-full" onClick={insertBibliography} icon={<BookOpen size={12} />}>Insert full bibliography ({references.length})</Button>
            <p className="mt-1.5 text-[9px] leading-relaxed text-slate-400">Citations are inserted at the cursor in {citationStyle} form. Always proofread the rendered reference list before submission.</p>
          </> : <p className="mt-1 text-[10px] leading-relaxed text-slate-400">No saved references. Search public metadata or import BibTeX/RIS first.</p>}
        </Card>
      </aside>

      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-2.5 dark:border-slate-800">
          <Input value={active?.title || ''} onChange={(event) => updateActive({ title: event.target.value })} placeholder="Draft title" aria-label="Draft title" className="!h-8 min-w-[160px] flex-1 !text-xs !font-bold" disabled={!active} />
          <span className="flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400"><ShieldCheck size={11} /> local</span>
          <Button size="sm" variant="ghost" onClick={copyDraft} disabled={!active} icon={<Copy size={12} />}>Copy</Button>
          <Button size="sm" variant="secondary" onClick={() => exportDraft('md')} disabled={!active} icon={<ArrowDownToLine size={12} />}>MD</Button>
        </div>
        {active ? <>
          <textarea ref={textareaRef} value={active.content} onChange={(event) => updateActive({ content: event.target.value })}
            placeholder="Write or paste your research draft here. Use Markdown headings if you want a simple structure."
            spellCheck className="block min-h-[58vh] w-full resize-y border-0 bg-white p-5 font-serif text-[14px] leading-[1.9] text-slate-700 outline-none placeholder:text-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-600" aria-label="Draft content" />
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-3 py-2 text-[9.5px] text-slate-400 dark:border-slate-800">
            <span>{stats.wordCount.toLocaleString()} words</span><span>·</span><span>{stats.sentenceCount.toLocaleString()} sentences</span><span>·</span><span>{stats.paragraphCount} paragraphs</span><span>·</span><span>{stats.readingMinutes < 1 ? '<1' : Math.round(stats.readingMinutes)} min read</span>
            <span className={`ml-auto ${dirty ? 'text-amber-500' : 'text-emerald-500'}`}>{dirty ? 'Unsaved changes' : 'Saved locally'}</span>
          </div>
        </> : <div className="grid min-h-[58vh] place-items-center p-6 text-center">
          <div><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-300"><FileText size={20} /></div><h2 className="mt-3 text-sm font-extrabold text-slate-700 dark:text-slate-200">Start a draft</h2><p className="mt-1 max-w-sm text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Create a new plain-text draft. Everything stays in this browser and autosaves while you write.</p><Button className="mt-3" onClick={createDraft} icon={<Plus size={13} />}>New draft</Button></div>
        </div>}
      </Card>

      <aside className="space-y-3">
        <Card className="p-3.5">
          <div className="flex items-center justify-between"><h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200"><Sparkles size={13} className="text-blue-500" />Writing checks</h2><Badge tone="blue">rule-based</Badge></div>
          <div className="mt-2 space-y-1.5">
            <CheckRow label="Readability" value={stats.flesch === null ? '—' : `${Math.round(stats.flesch)} · ${readabilityLabel(stats.flesch)}`} good={stats.flesch === null || stats.flesch >= 50} />
            <CheckRow label="Avg. sentence" value={`${stats.averageSentenceLength.toFixed(1)} words`} good={stats.averageSentenceLength > 0 && stats.averageSentenceLength <= 25} />
            <CheckRow label="Long sentences" value={longSentenceList.length ? `${stats.longSentences.length} over 30 words` : 'No long sentences'} good={!stats.longSentences.length} />
            <CheckRow label="Repeated terms" value={stats.repeated.length ? stats.repeated.map(([word, count]: [string, number]) => `${word} (${count})`).join(', ') : 'None above threshold'} good={!stats.repeated.length} />
            <CheckRow label="Filler phrases" value={stats.fillers.length ? stats.fillers.map((entry: { phrase: string; count: number }) => `${entry.phrase} (${entry.count})`).join(', ') : 'None detected'} good={!stats.fillers.length} />
            <CheckRow label="Possible passive voice" value={stats.passiveCount ? `${stats.passiveCount} phrase(s); review in context` : 'No simple patterns found'} good={!stats.passiveCount} />
            <CheckRow label="In-text citations" value={`${stats.citationCount} author–year pattern(s)`} good={stats.citationCount > 0} neutral={!stats.wordCount} />
            <CheckRow label="Markdown headings" value={stats.headingCount ? `${stats.headingCount} heading(s)` : 'None'} good={stats.headingCount > 0} neutral={!stats.wordCount} />
          </div>
          <Callout tone="warning">These heuristics can produce false positives. They are not a grammar checker and cannot reliably detect AI-generated text.</Callout>
        </Card>

        {longSentenceList.length > 0 && <Card className="p-3.5">
          <h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200"><TriangleAlert size={13} className="text-amber-500" />Consider splitting</h2>
          <ul className="mt-2 space-y-2">
            {longSentenceList.map((sentence: { index: number; words: number; text: string }) => <li key={sentence.index} className="rounded-md bg-slate-50 p-2 text-[9.5px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">Sentence {sentence.index} · {sentence.words} words<br /><span className="line-clamp-3">{sentence.text.slice(0, 220)}{sentence.text.length > 220 ? '…' : ''}</span></li>)}
          </ul>
        </Card>}

        <Card className="p-3.5">
          <h2 className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Export & safety</h2>
          <div className="mt-2 grid gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => exportDraft('txt')} disabled={!active} icon={<ArrowDownToLine size={12} />}>Plain text (.txt)</Button>
            <Button size="sm" variant="secondary" onClick={() => exportDraft('md')} disabled={!active} icon={<ArrowDownToLine size={12} />}>Markdown (.md)</Button>
            <Button size="sm" variant="ghost" onClick={copyDraft} disabled={!active} icon={<Copy size={12} />}>Copy all text</Button>
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-slate-400">Export regularly. Drafts are stored in IndexedDB and can be lost if browser site data is cleared.</p>
        </Card>
      </aside>
    </div>
  </div>
}

function CheckRow({ label, value, good, neutral = false }: { label: string; value: string; good: boolean; neutral?: boolean }) {
  return <div className="flex gap-2 border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-800">
    <span className={`mt-0.5 shrink-0 ${neutral ? 'text-slate-300' : good ? 'text-emerald-500' : 'text-amber-500'}`}>{neutral ? <FileText size={11} /> : good ? <Check size={11} /> : <TriangleAlert size={11} />}</span>
    <div className="min-w-0"><div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{label}</div><div className="break-words text-[9px] leading-relaxed text-slate-400">{value}</div></div>
  </div>
}
