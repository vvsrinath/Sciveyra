import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent as ReactClipboardEvent } from 'react'
import {
  ArrowDownToLine, BookOpen, Bold, Check, ClipboardPaste, Code2, Copy, Eye, FileDown,
  FileText, FileUp, Heading2, Image as ImageIcon, ImagePlus, Italic, Link2, List,
  ListOrdered, Map, Paperclip, Plus, Quote, Redo2, Save, ShieldCheck, Sparkles, Trash2,
  TriangleAlert, Underline, Undo2, Upload, WandSparkles, X
} from 'lucide-react'
import { Badge, Button, Callout, Card, Field, Input, Modal, PageHeader, ProgressBar, Select, Spinner } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { useAutosave } from '../../app/useAutosave'
import { dbDelete, dbGetAll, dbPut, getSetting, setSetting } from '../../lib/storage.js'
import { analyzeDraft, readabilityLabel } from '../../lib/writing.js'
import { inlineCitation, formatCitation, CITATION_STYLES } from '../../lib/references.js'
import { copyText, downloadBlob, downloadText, readFileAsDataURL, readFileAsText } from '../../lib/export.js'
import {
  htmlToMarkdown, markdownToHtml, plainTextToMarkdown, sanitizeUrl, titleFromMarkdown
} from '../../lib/documentMarkdown.js'
import {
  DOCX_MIME, MAX_DOCUMENT_BYTES, MAX_EMBED_BYTES, buildDocxBlob, documentKind, importDocx,
  markdownExport, readArrayBuffer, textExport
} from '../../lib/documentFormats.js'
import { nowIso, uid } from '../../lib/util.js'
import { canRedo, canUndo, emptyEditStack, initialEditStack, pushEdit, redoStack, undoStack } from '../../lib/history.js'
import {
  DRAFT_TEMPLATES, buildTemplateContent, claimStatus, evidenceMapMarkdown, getTemplate,
  makeClaim, parseSections, referenceLabel, sectionAt, sectionGuidance, summarizeClaims
} from '../../lib/drafting.js'
import { applyRewriteDecisions, buildRewriteDiff, summarizeRewriteDiff } from '../../lib/rewriteDiff.js'
import {
  analyzeParagraph, DEFAULT_OLLAMA_ENDPOINT, DEFAULT_OLLAMA_MODEL, normalizeEndpoint,
  REWRITE_PRESETS, rewriteParagraph, rewriteWithOllama, summarizeChanges
} from '../../lib/rewriter.js'
import type { Asset, ClaimRecord, DraftRecord, Reference } from '../../types'

type RewriteEngine = 'local' | 'ollama'
type SelectionSpan = { start: number; end: number; text: string }
type RewriteSuggestion = {
  selection: SelectionSpan
  engine: RewriteEngine
  preset: string
  original: string
  rewritten: string
  diff: ReturnType<typeof buildRewriteDiff>
  createdAt: string
}
type EditStack = ReturnType<typeof emptyEditStack>

function newDraft(): DraftRecord {
  return { id: uid('draft'), title: 'Untitled draft', content: '', createdAt: nowIso(), updatedAt: nowIso() }
}

export default function WritingLab() {
  const { notify, refreshToken, bumpRefresh, markSaved, saveStatus } = useApp()
  const [drafts, setDrafts] = useState<DraftRecord[]>([])
  const [active, setActive] = useState<DraftRecord | null>(null)
  const [references, setReferences] = useState<Reference[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [importBusy, setImportBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteMarkdown, setPasteMarkdown] = useState('')
  const [pasteHint, setPasteHint] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [assetOpen, setAssetOpen] = useState(false)
  const [editStack, setEditStack] = useState<EditStack>(emptyEditStack())
  const [target, setTarget] = useState('1000')
  const [templateId, setTemplateId] = useState(DRAFT_TEMPLATES[0].id)
  const [citationId, setCitationId] = useState('')
  const [citationStyle, setCitationStyle] = useState('APA 7')
  const [selection, setSelection] = useState<SelectionSpan | null>(null)
  const [rewriteEngine, setRewriteEngine] = useState<RewriteEngine>('local')
  const [rewritePreset, setRewritePreset] = useState('natural')
  const [endpoint, setEndpoint] = useState(DEFAULT_OLLAMA_ENDPOINT)
  const [model, setModel] = useState(DEFAULT_OLLAMA_MODEL)
  const [suggestion, setSuggestion] = useState<RewriteSuggestion | null>(null)
  const [decisions, setDecisions] = useState<Record<string, boolean>>({})
  const [claimChoice, setClaimChoice] = useState<Record<string, string>>({})
  const [rewriteBusy, setRewriteBusy] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef<DraftRecord | null>(null)
  const rewriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  activeRef.current = active

  const claims = useMemo<ClaimRecord[]>(() => active?.claims || [], [active?.claims])
  const sections = useMemo(() => parseSections(active?.content || ''), [active?.content])
  const visualAssets = useMemo(() => assets.filter((asset) => asset.kind === 'image' || asset.kind === 'svg'), [assets])
  const previewHtml = useMemo(() => markdownToHtml(active?.content || '', {
    resolveSource: (id: string) => assets.find((asset) => asset.id === id)?.data || ''
  }), [active?.content, assets])
  const claimSummary = useMemo(
    () => summarizeClaims(claims, active?.content || '', references),
    [claims, active?.content, references]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [draftList, referenceList, assetList, storedEndpoint, storedModel] = await Promise.all([
          dbGetAll('drafts') as Promise<DraftRecord[]>,
          dbGetAll('references') as Promise<Reference[]>,
          dbGetAll('assets') as Promise<Asset[]>,
          getSetting('ollamaEndpoint', DEFAULT_OLLAMA_ENDPOINT) as Promise<string>,
          getSetting('ollamaModel', DEFAULT_OLLAMA_MODEL) as Promise<string>
        ])
        if (cancelled) return
        const sorted = draftList.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        setDrafts(sorted)
        setReferences(referenceList)
        setAssets(assetList.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
        setActive(sorted[0] || null)
        if (referenceList[0]) setCitationId(referenceList[0].id)
        if (storedEndpoint) setEndpoint(storedEndpoint)
        if (storedModel) setModel(storedModel)
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Drafts could not be loaded.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  useEffect(() => {
    setEditStack(initialEditStack(active))
    setSelection(null)
    setSuggestion(null)
    setDecisions({})
    setClaimChoice({})
    setTemplateId(active?.template || DRAFT_TEMPLATES[0].id)
    // Re-seed only when switching drafts; edits keep their own stack.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  useEffect(() => () => {
    if (rewriteTimer.current) clearTimeout(rewriteTimer.current)
  }, [])

  const { pending: autosavePending } = useAutosave(active, {
    delay: 700,
    enabled: Boolean(active && !loading),
    serialize: (draft) => JSON.stringify(draft),
    onSave: async (draft) => {
      if (!draft) return
      await dbPut('drafts', draft)
      setDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)]
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
    }
  })

  const createDraft = async (options: { silentRefresh?: boolean } = {}) => {
    try {
      const draft = newDraft()
      await dbPut('drafts', draft)
      setDrafts((current) => [draft, ...current])
      setActive(draft)
      activeRef.current = draft
      if (!options.silentRefresh) bumpRefresh()
      setTimeout(() => textareaRef.current?.focus(), 50)
      return draft
    } catch (error) {
      notify(error instanceof Error ? error.message : 'A new draft could not be created.', 'error')
      return null
    }
  }

  const ensureDraft = async () => activeRef.current || createDraft({ silentRefresh: true })

  const reportWarnings = (warnings: string[]) => {
    if (!warnings.length) return
    notify(`${warnings[0]}${warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}`, 'warning')
  }

  const updateActive = (patch: Partial<DraftRecord>) => {
    setActive((current) => current ? { ...current, ...patch, updatedAt: nowIso() } : current)
  }

  const applyEdit = (field: string, patch: Partial<DraftRecord>) => {
    const current = activeRef.current
    if (!current) return
    const next = { ...current, ...patch, updatedAt: nowIso() }
    setEditStack((stack) => pushEdit(stack, next, { field }))
    setActive(next)
  }

  const saveDraft = async (silent = false) => {
    const draft = activeRef.current
    if (!draft) return
    try {
      await dbPut('drafts', draft)
      setDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)]
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
      markSaved()
      if (!silent) notify('Draft saved locally.', 'success')
    } catch (error) {
      if (!silent) notify(error instanceof Error ? error.message : 'The draft could not be saved.', 'error')
    }
  }

  const applySnapshot = (snapshot: DraftRecord | null) => {
    if (!snapshot) return
    setActive({ ...snapshot, updatedAt: nowIso() })
    setTemplateId(snapshot.template || DRAFT_TEMPLATES[0].id)
    setSuggestion(null)
    setDecisions({})
    setClaimChoice({})
  }

  const undo = () => {
    const next = undoStack(editStack)
    if (!next || !next.present) return
    setEditStack(next)
    applySnapshot(next.present.value)
  }

  const redo = () => {
    const next = redoStack(editStack)
    if (!next || !next.present) return
    setEditStack(next)
    applySnapshot(next.present.value)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const inDraftField = target === textareaRef.current || target?.getAttribute('aria-label') === 'Draft title'
      if (!inDraftField || !(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 's') { event.preventDefault(); void saveDraft(); return }
      if (key === 'z' || key === 'y') {
        event.preventDefault()
        if (key === 'y' || event.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editStack, active])

  const removeDraft = async (draft: DraftRecord) => {
    if (!window.confirm(`Delete draft "${draft.title}"? A recoverable snapshot will remain in version history.`)) return
    try {
      await dbDelete('drafts', draft.id)
      const next = drafts.filter((item) => item.id !== draft.id)
      setDrafts(next)
      if (active?.id === draft.id) setActive(next[0] || null)
      bumpRefresh()
      notify('Draft deleted. The previous version is available in Version history.', 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The draft could not be deleted.', 'error')
    }
  }

  const draftFilename = (draft: DraftRecord) => (draft.title || 'draft').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '') || 'draft'

  const exportDraft = async (format: 'txt' | 'md' | 'docx') => {
    const draft = activeRef.current
    if (!draft || exportBusy) return
    setExportBusy(true)
    try {
      const base = draftFilename(draft)
      if (format === 'docx') {
        const result = await buildDocxBlob(draft.content, { title: draft.title, assets })
        downloadBlob(result.blob, `${base}.docx`)
        reportWarnings(result.warnings)
        notify('Draft exported as Word .docx with headings, formatting, links and images.', 'success')
      } else if (format === 'md') {
        const result = markdownExport(draft.content, assets)
        downloadText(result.text, `${base}.md`, 'text/markdown;charset=utf-8')
        reportWarnings(result.warnings)
        notify('Draft exported as Markdown with saved assets embedded.', 'success')
      } else {
        const result = textExport(draft.content, assets)
        downloadText(result.text, `${base}.txt`, 'text/plain;charset=utf-8')
        reportWarnings(result.warnings)
        notify('Draft exported as plain text.', 'success')
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : `The ${format.toUpperCase()} export failed.`, 'error')
    } finally {
      setExportBusy(false)
    }
  }

  const importDocument = async (file?: File) => {
    if (!file) return
    const kind = documentKind(file)
    if (!kind) { notify('Choose a .docx, .md, .txt or .html file.', 'warning'); return }
    if (file.size > MAX_DOCUMENT_BYTES) { notify('That document is larger than 25 MB. Split it before importing.', 'warning'); return }
    setImportBusy(true)
    try {
      let content = ''
      let warnings: string[] = []
      if (kind === 'docx') {
        const result = await importDocx(await readArrayBuffer(file))
        content = result.markdown
        warnings = result.warnings
      } else {
        const raw = await readFileAsText(file)
        content = kind === 'html' ? htmlToMarkdown(raw) : plainTextToMarkdown(raw)
      }
      if (!content.trim()) throw new Error('The file contained no readable text.')
      const draft = await ensureDraft()
      if (!draft) throw new Error('A draft could not be created for the import.')
      if (draft.content.trim() && !window.confirm('Replace the current draft content with the imported document? The previous state stays in Version history.')) return
      applyEdit('import', {
        content,
        title: titleFromMarkdown(content, file.name),
        template: draft.template,
        claims: []
      })
      setPreview(false)
      setSelection(null)
      setSuggestion(null)
      reportWarnings(warnings)
      notify(`${file.name} imported. Review formatting and claim links before editing.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The document could not be imported.', 'error')
    } finally {
      setImportBusy(false)
      if (documentInputRef.current) documentInputRef.current.value = ''
    }
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
    applyEdit('content', { content })
    setTimeout(() => {
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(start + insertText.length, start + insertText.length)
    }, 0)
  }

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const draft = activeRef.current
    if (!draft) return
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? draft.content.length
    const end = textarea?.selectionEnd ?? start
    const selected = draft.content.slice(start, end) || placeholder
    const insert = `${before}${selected}${after}`
    applyEdit('format', { content: `${draft.content.slice(0, start)}${insert}${draft.content.slice(end)}` })
    setTimeout(() => {
      if (!textarea) return
      textarea.focus()
      const cursor = start + before.length + selected.length
      textarea.setSelectionRange(cursor, cursor)
    }, 0)
  }

  const prefixLines = (prefix: string) => {
    const draft = activeRef.current
    if (!draft) return
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? draft.content.length
    const end = textarea?.selectionEnd ?? start
    const lineStart = draft.content.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const newline = draft.content.indexOf('\n', end)
    const lineEnd = newline === -1 ? draft.content.length : newline
    const block = draft.content.slice(lineStart, lineEnd) || 'text'
    const changed = block.split('\n').map((line) => line.trimStart().startsWith(prefix.trim()) ? line : `${prefix}${line}`).join('\n')
    applyEdit('format', { content: `${draft.content.slice(0, lineStart)}${changed}${draft.content.slice(lineEnd)}` })
    setTimeout(() => {
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(lineStart + changed.length, lineStart + changed.length)
    }, 0)
  }

  const openLinkDialog = () => {
    const draft = activeRef.current
    const textarea = textareaRef.current
    const selected = draft && textarea ? draft.content.slice(textarea.selectionStart, textarea.selectionEnd).trim() : ''
    setLinkLabel(selected)
    setLinkUrl('')
    setLinkOpen(true)
  }

  const insertLink = () => {
    const href = sanitizeUrl(linkUrl)
    if (!href) { notify('Enter a safe http(s), mailto, relative or saved-asset link.', 'warning'); return }
    const label = linkLabel.trim() || href
    insertAtCursor(`[${label.replace(/[[\]]/g, '')}](${href})`)
    setLinkOpen(false)
    setLinkLabel('')
    setLinkUrl('')
    notify('Link inserted. It is preserved in Word, Markdown and preview exports.', 'success')
  }

  const saveLocalAsset = async (file: File, kind: 'image' | 'svg' | 'file') => {
    if (file.size > MAX_EMBED_BYTES) throw new Error('Files over 8 MB are not inserted automatically. Add a link instead.')
    const data = await readFileAsDataURL(file)
    const asset: Asset = {
      id: uid('asset'),
      name: file.name || 'Untitled asset',
      kind,
      data,
      mime: file.type || (kind === 'svg' ? 'image/svg+xml' : 'application/octet-stream'),
      size: file.size,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
    await dbPut('assets', asset)
    setAssets((current) => [asset, ...current])
    return asset
  }

  const insertImageFile = async (file?: File) => {
    if (!file) return
    try {
      const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
      if (!/^image\//.test(file.type) && !isSvg) { notify('Choose a PNG, JPEG, GIF, WebP or SVG image.', 'warning'); return }
      const asset = await saveLocalAsset(file, isSvg ? 'svg' : 'image')
      insertAtCursor(`![${asset.name.replace(/[[\]]/g, '')}](asset://${asset.id})`)
      notify('Image saved to SciVeyra assets and inserted. It will be embedded in exported files.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The image could not be inserted.', 'error')
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  const insertLocalFile = async (file?: File) => {
    if (!file) return
    try {
      const asset = await saveLocalAsset(file, 'file')
      insertAtCursor(`[${asset.name.replace(/[[\]]/g, '')}](asset://${asset.id})`)
      notify('File saved to SciVeyra assets and inserted as a link.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The file could not be inserted.', 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const insertSavedAsset = (asset: Asset) => {
    const label = asset.name.replace(/[[\]]/g, '')
    const isVisual = asset.kind === 'image' || asset.kind === 'svg'
    insertAtCursor(isVisual ? `![${label}](asset://${asset.id})` : `[${label}](asset://${asset.id})`)
    setAssetOpen(false)
    notify(isVisual
      ? 'Saved visual asset inserted. Export embeds the current stored image.'
      : 'Saved file inserted as a link.', 'success')
  }

  const pasteHtml = (event: ReactClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const html = event.clipboardData.getData('text/html')
    const plain = event.clipboardData.getData('text/plain')
    if (html && htmlToMarkdown(html)) {
      setPasteMarkdown(htmlToMarkdown(html))
      setPasteHint('Formatted text, headings, lists, tables and links were converted to Markdown. Review it before inserting.')
    } else {
      setPasteMarkdown(plainTextToMarkdown(plain))
      setPasteHint('Plain text pasted. Add Markdown headings or use the formatting toolbar if needed.')
    }
  }

  const insertPasted = (mode: 'insert' | 'replace') => {
    const pasted = pasteMarkdown.trim()
    const draft = activeRef.current
    if (!draft || !pasted) { notify('Paste or type content in the box first.', 'warning'); return }
    if (mode === 'replace') {
      if (draft.content.trim() && !window.confirm('Replace the current draft with the pasted content? The previous state stays in Version history.')) return
      applyEdit('paste', { content: pasted, claims: [] })
      setSelection(null)
      setSuggestion(null)
    } else {
      insertAtCursor(`\n\n${pasted}\n\n`)
    }
    setPasteOpen(false)
    setPasteMarkdown('')
    setPasteHint('')
    notify(mode === 'replace' ? 'Draft replaced with pasted content.' : 'Pasted content inserted at the cursor.', 'success')
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

  const captureSelection = (): SelectionSpan | null => {
    const textarea = textareaRef.current
    const draft = activeRef.current
    if (!textarea || !draft) return null
    let start = textarea.selectionStart
    let end = textarea.selectionEnd
    if (start === end) {
      const content = draft.content
      const previous = content.lastIndexOf('\n\n', Math.max(0, start - 1))
      const next = content.indexOf('\n\n', end)
      start = previous === -1 ? 0 : previous + 2
      end = next === -1 ? content.length : next
    }
    if (end <= start) { setSelection(null); return null }
    const span = { start, end, text: draft.content.slice(start, end) }
    setSelection(span)
    return span
  }

  const applyTemplate = () => {
    if (!active) return
    if (active.content.trim() && !window.confirm('Replace the current draft content with this outline? Existing text and claim links will be removed; the previous state stays in Version history.')) return
    applyEdit('template', { template: templateId, content: buildTemplateContent(templateId, active.title), claims: [] })
    setSelection(null)
    setSuggestion(null)
    setDecisions({})
    setClaimChoice({})
    notify(`${getTemplate(templateId)?.label || 'Outline'} applied. Section prompts appear in the Outline panel.`, 'success')
    setTimeout(() => { textareaRef.current?.focus(); textareaRef.current?.setSelectionRange(0, 0) }, 0)
  }

  const jumpToSection = (position: number) => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(position, position)
    const ratio = position / Math.max(1, active?.content.length || 1)
    textarea.scrollTop = Math.max(0, ratio * textarea.scrollHeight - 24)
  }

  const addClaim = () => {
    if (!active) return
    const span = captureSelection() || (selection?.text ? selection : null)
    if (!span || !span.text.trim()) { notify('Select a sentence in the draft first, then add it as a claim.', 'warning'); return }
    const text = span.text.trim()
    if (claims.some((claim) => claim.text.trim() === text)) { notify('This claim is already tracked.', 'info'); return }
    const offset = Math.max(0, span.text.indexOf(text))
    const start = span.start + offset
    const claim = makeClaim({
      id: uid('claim'),
      text,
      start,
      end: start + text.length,
      section: sectionAt(sections, start)?.title || '',
      referenceIds: [],
      createdAt: nowIso()
    })
    applyEdit('claims', { claims: [...claims, claim] })
    notify(references.length ? 'Claim added. Link at least one saved reference as evidence.' : 'Claim added. Save references first, then link evidence.', 'info')
  }

  const linkReference = (claimId: string) => {
    if (!active) return
    const referenceId = claimChoice[claimId]
    if (!referenceId) return
    const target = claims.find((claim) => claim.id === claimId)
    if (!target) return
    if (target.referenceIds.includes(referenceId)) { notify('That reference is already linked to this claim.', 'info'); return }
    applyEdit('claims', {
      claims: claims.map((claim) => claim.id === claimId
        ? { ...claim, referenceIds: [...claim.referenceIds, referenceId] }
        : claim)
    })
    setClaimChoice((current) => ({ ...current, [claimId]: '' }))
    notify('Reference linked as evidence for this claim.', 'success')
  }

  const unlinkReference = (claimId: string, referenceId: string) => {
    if (!active) return
    applyEdit('claims', {
      claims: claims.map((claim) => claim.id === claimId
        ? { ...claim, referenceIds: claim.referenceIds.filter((id) => id !== referenceId) }
        : claim)
    })
  }

  const removeClaim = (claimId: string) => {
    if (!active) return
    applyEdit('claims', { claims: claims.filter((claim) => claim.id !== claimId) })
    setClaimChoice((current) => {
      const next = { ...current }
      delete next[claimId]
      return next
    })
    notify('Claim removed from the evidence map.', 'info')
  }

  const exportEvidenceMap = () => {
    if (!active) return
    const base = (active.title || 'draft').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    downloadText(
      evidenceMapMarkdown(claims, active.content, references, active.title),
      `${base}-evidence-map.md`,
      'text/markdown;charset=utf-8'
    )
    notify('Evidence map exported as Markdown.', 'success')
  }

  const generateSuggestion = async () => {
    const selected = selection && selection.text ? selection : captureSelection()
    if (!selected || !selected.text.trim()) { notify('Select a sentence or paragraph in the draft first.', 'warning'); return }
    setRewriteBusy(true)
    const controller = new AbortController()
    rewriteTimer.current = setTimeout(() => controller.abort(), rewriteEngine === 'ollama' ? 90000 : 5000)
    try {
      let rewritten: string
      if (rewriteEngine === 'local') {
        rewritten = rewriteParagraph(selected.text, { preset: rewritePreset })
      } else {
        const cleanEndpoint = normalizeEndpoint(endpoint)
        rewritten = await rewriteWithOllama(selected.text, {
          endpoint: cleanEndpoint, model, preset: rewritePreset, signal: controller.signal
        })
        setEndpoint(cleanEndpoint)
        await setSetting('ollamaEndpoint', cleanEndpoint).catch(() => {})
        await setSetting('ollamaModel', model).catch(() => {})
      }
      if (rewritten === selected.text) {
        notify('No changes were suggested for this selection.', 'info')
        setSuggestion(null)
        return
      }
      setSuggestion({
        selection: selected,
        engine: rewriteEngine,
        preset: rewritePreset,
        original: selected.text,
        rewritten,
        diff: buildRewriteDiff(selected.text, rewritten),
        createdAt: nowIso()
      })
      setDecisions({})
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The rewrite could not be generated.', 'error')
    } finally {
      if (rewriteTimer.current) clearTimeout(rewriteTimer.current)
      rewriteTimer.current = null
      setRewriteBusy(false)
    }
  }

  const applySuggestion = () => {
    const draft = activeRef.current
    if (!draft || !suggestion) return
    const { start, end, text } = suggestion.selection
    if (draft.content.slice(start, end) !== text) {
      notify('The draft changed since this suggestion was made. Generate a new one.', 'warning')
      return
    }
    const acceptedText = applyRewriteDecisions(suggestion.diff, decisions)
    const content = `${draft.content.slice(0, start)}${acceptedText}${draft.content.slice(end)}`
    applyEdit('content', { content })
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(start, start + acceptedText.length)
    }, 0)
    const count = summarizeRewriteDiff(suggestion.diff, decisions)
    notify(`${count.accepted} of ${count.total} change(s) applied to the draft.`, 'success')
    setSuggestion(null)
    setSelection(null)
    setDecisions({})
  }

  const stats = useMemo(() => analyzeDraft(active?.content || ''), [active?.content])
  const changeSummary = useMemo(() => suggestion ? summarizeChanges(suggestion.original, suggestion.rewritten) : null, [suggestion])
  const targetNumber = Math.max(1, Number(target) || 1000)
  const longSentenceList = stats.longSentences.slice(0, 4)

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Spinner label="Opening Writing Lab…" /></div>

  return <div>
    <PageHeader eyebrow="WRITING / 01" title="Writing Lab" description="Draft a complete paper with outlines, Word/Google Docs import and export, links, images, saved visual assets, citation tools, a claim–evidence map and reviewable local rewrites."
      actions={<>
        <Button variant="ghost" onClick={undo} disabled={!canUndo(editStack)} icon={<Undo2 size={14} />} title="Undo (Ctrl/Cmd+Z)">Undo</Button>
        <Button variant="ghost" onClick={redo} disabled={!canRedo(editStack)} icon={<Redo2 size={14} />} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</Button>
        <Button variant="secondary" onClick={() => documentInputRef.current?.click()} disabled={importBusy} icon={<Upload size={14} />}>{importBusy ? 'Importing…' : 'Import'}</Button>
        <Button variant="secondary" onClick={() => void exportDraft('docx')} disabled={!active || exportBusy} icon={<FileDown size={14} />}>{exportBusy ? 'Exporting…' : 'Word (.docx)'}</Button>
        <Button variant="primary" onClick={() => saveDraft()} disabled={!active || !autosavePending} icon={<Save size={14} />}>{autosavePending ? 'Save draft' : 'Saved'}</Button>
      </>}
    />

    <input ref={documentInputRef} type="file" accept=".md,.markdown,.txt,.docx,.html,.htm,text/markdown,text/plain,text/html" className="hidden" onChange={(event) => void importDocument(event.target.files?.[0])} aria-label="Import document" />
    <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="hidden" onChange={(event) => void insertImageFile(event.target.files?.[0])} aria-label="Insert image file" />
    <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => void insertLocalFile(event.target.files?.[0])} aria-label="Insert local file" />

    <div className="grid items-start gap-3 xl:grid-cols-[220px_minmax(0,1fr)_290px]">
      <aside className="space-y-2">
        <Card className="p-2.5">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-extrabold text-slate-700">Drafts</h2><Badge tone="slate">{drafts.length}</Badge></div>
          <div className="max-h-[430px] space-y-1 overflow-auto">
            {drafts.map((draft) => <div key={draft.id} className={`group flex items-center gap-1 rounded-md border p-1.5 ${active?.id === draft.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100'}`}>
              <button type="button" onClick={() => setActive(draft)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[10px] font-bold text-slate-700">{draft.title || 'Untitled draft'}</span>
                <span className="mt-0.5 block text-[9px] text-slate-400">{new Date(draft.updatedAt).toLocaleDateString()}</span>
              </button>
              <button type="button" onClick={() => removeDraft(draft)} aria-label={`Delete ${draft.title}`} className="text-slate-300 hover:text-red-500"><Trash2 size={11} /></button>
            </div>)}
            {!drafts.length && <p className="px-1 py-2 text-[10px] text-slate-400">No drafts yet.</p>}
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={() => void createDraft()} icon={<Plus size={12} />}>New draft</Button>
          <Button size="sm" variant="secondary" className="mt-1.5 w-full" onClick={() => documentInputRef.current?.click()} disabled={importBusy} icon={<FileUp size={12} />}>{importBusy ? 'Importing…' : 'Import document'}</Button>
        </Card>

        <Card className="p-3">
          <h2 className="text-xs font-extrabold text-slate-700">Word target</h2>
          <div className="mt-2 flex items-center gap-1.5"><Input type="number" min={1} value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Word target" /><span className="text-[10px] text-slate-400">words</span></div>
          <ProgressBar value={Math.min(100, (stats.wordCount / targetNumber) * 100)} />
          <p className="mt-1 text-[9.5px] text-slate-400">{stats.wordCount.toLocaleString()} / {targetNumber.toLocaleString()} words</p>
        </Card>

        <Card className="p-3">
          <h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700"><List size={13} className="text-blue-500" />Outline templates</h2>
          <Field label="Structure" className="mt-2">
            <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="!h-8 !text-[11px]" aria-label="Outline template">
              {DRAFT_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
            </Select>
          </Field>
          <p className="mt-1.5 text-[9px] leading-relaxed text-slate-400">{getTemplate(templateId)?.description}</p>
          <Button size="sm" className="mt-2 w-full" onClick={applyTemplate} disabled={!active} icon={<FileText size={12} />}>Apply outline</Button>
          <p className="mt-1.5 text-[9px] leading-relaxed text-slate-400">Adds clean Markdown headings. Writing prompts stay in this panel, not in the exported draft.</p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between"><h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700"><List size={13} className="text-indigo-500" />Section guide</h2><Badge tone="slate">{sections.length}</Badge></div>
          {sections.length ? <div className="mt-2 max-h-[300px] space-y-1.5 overflow-auto pr-0.5">
            {sections.map((section) => <div key={section.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2">
              <button type="button" onClick={() => jumpToSection(section.start)} className="flex w-full items-center justify-between gap-2 text-left" title="Jump to this section">
                <span className="min-w-0 truncate text-[10px] font-bold text-slate-700">{section.title}</span>
                <span className="shrink-0 text-[9px] text-slate-400">{section.wordCount} words</span>
              </button>
              <p className="mt-1 text-[9px] leading-relaxed text-slate-500">{sectionGuidance(active?.template, section.title)}</p>
            </div>)}
          </div> : <p className="mt-2 text-[10px] leading-relaxed text-slate-400">No Markdown headings yet. Apply an outline above or add your own <code>## Section</code> headings to jump between sections.</p>}
        </Card>

        <Card className="p-3">
          <h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700"><BookOpen size={13} className="text-blue-500" />Insert citation</h2>
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
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-2.5">
          <Input value={active?.title || ''} onChange={(event) => applyEdit('title', { title: event.target.value })} placeholder="Draft title" aria-label="Draft title" className="!h-8 min-w-[150px] flex-1 !text-xs !font-bold" disabled={!active} />
          <span className="flex items-center gap-1 text-[9px] text-emerald-600"><ShieldCheck size={11} /> local</span>
          <Button size="sm" variant={preview ? 'primary' : 'secondary'} onClick={() => setPreview((value) => !value)} disabled={!active} icon={<Eye size={12} />}>{preview ? 'Write' : 'Preview'}</Button>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/50 px-2.5 py-1.5">
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => prefixLines('## ')} disabled={!active || preview} title="Heading"><Heading2 size={13} /></Button>
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => wrapSelection('**', '**', 'bold text')} disabled={!active || preview} title="Bold"><Bold size={13} /></Button>
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => wrapSelection('*', '*', 'italic text')} disabled={!active || preview} title="Italic"><Italic size={13} /></Button>
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => wrapSelection('<u>', '</u>', 'underlined text')} disabled={!active || preview} title="Underline"><Underline size={13} /></Button>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => prefixLines('- ')} disabled={!active || preview} title="Bullet list"><List size={13} /></Button>
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => prefixLines('1. ')} disabled={!active || preview} title="Numbered list"><ListOrdered size={13} /></Button>
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => prefixLines('> ')} disabled={!active || preview} title="Quote"><Quote size={13} /></Button>
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => wrapSelection('```\n', '\n```', 'code')} disabled={!active || preview} title="Code block"><Code2 size={13} /></Button>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={openLinkDialog} disabled={!active || preview} title="Insert link"><Link2 size={13} /></Button>
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => imageInputRef.current?.click()} disabled={!active || preview} title="Insert image"><ImagePlus size={13} /></Button>
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => fileInputRef.current?.click()} disabled={!active || preview} title="Attach file"><Paperclip size={13} /></Button>
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => setAssetOpen(true)} disabled={!active || preview} title="Insert saved SciVeyra asset"><ImageIcon size={13} /></Button>
          <Button size="sm" variant="ghost" className="!h-7 !px-2" onClick={() => setPasteOpen(true)} disabled={!active || preview} title="Paste from Word or Google Docs"><ClipboardPaste size={13} /></Button>
          <span className="ml-auto text-[9px] text-slate-400">{assets.length} saved asset{assets.length === 1 ? '' : 's'}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-2.5 py-1.5">
          <Button size="sm" variant="secondary" onClick={captureSelection} disabled={!active || preview} icon={<WandSparkles size={12} />}>Rewrite selection</Button>
          <Button size="sm" variant="ghost" onClick={copyDraft} disabled={!active} icon={<Copy size={12} />}>Copy</Button>
          <Button size="sm" variant="secondary" onClick={() => void exportDraft('md')} disabled={!active || exportBusy} icon={<ArrowDownToLine size={12} />}>MD</Button>
          <Button size="sm" variant="secondary" onClick={() => void exportDraft('txt')} disabled={!active || exportBusy} icon={<ArrowDownToLine size={12} />}>TXT</Button>
          <Button size="sm" variant="secondary" onClick={() => void exportDraft('docx')} disabled={!active || exportBusy} icon={<FileDown size={12} />}>DOCX</Button>
        </div>

        {active ? <>
          {preview ? <div
            className="markdown-preview min-h-[58vh] bg-white p-5 font-serif text-[14px] leading-[1.9] text-slate-700"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          /> : <textarea ref={textareaRef} value={active.content}
            onChange={(event) => applyEdit('content', { content: event.target.value })}
            onSelect={captureSelection}
            onKeyUp={captureSelection}
            onClick={captureSelection}
            placeholder="Write or paste your research draft here. Use the toolbar for headings, formatting, links, images and saved assets."
            spellCheck className="block min-h-[58vh] w-full resize-y border-0 bg-white p-5 font-serif text-[14px] leading-[1.9] text-slate-700 outline-none placeholder:text-slate-300" aria-label="Draft content" />}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-3 py-2 text-[9.5px] text-slate-400">
            <span>{stats.wordCount.toLocaleString()} words</span><span>·</span><span>{stats.sentenceCount.toLocaleString()} sentences</span><span>·</span><span>{stats.paragraphCount} paragraphs</span><span>·</span><span>{stats.readingMinutes < 1 ? '<1' : Math.round(stats.readingMinutes)} min read</span>
            <span className={`ml-auto ${autosavePending || saveStatus === 'saving' ? 'text-amber-500' : saveStatus === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>
              {saveStatus === 'error' ? 'Save failed — retry' : autosavePending || saveStatus === 'saving' ? 'Autosaving…' : 'Saved locally'}
            </span>
          </div>
        </> : <div className="grid min-h-[58vh] place-items-center p-6 text-center">
          <div><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-500"><FileText size={20} /></div><h2 className="mt-3 text-sm font-extrabold text-slate-700">Start or import a draft</h2><p className="mt-1 max-w-sm text-[10px] leading-relaxed text-slate-500">Create a new draft, import a .docx/.md/.txt file, or paste from Word or Google Docs. Everything stays in this browser.</p><div className="mt-3 flex flex-wrap justify-center gap-2"><Button onClick={() => void createDraft()} icon={<Plus size={13} />}>New draft</Button><Button variant="secondary" onClick={() => documentInputRef.current?.click()} icon={<FileUp size={13} />}>Import document</Button></div></div>
        </div>}
      </Card>

      <aside className="space-y-3">
        <Card className="p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700"><WandSparkles size={13} className="text-violet-500" />Inline rewrite</h2>
            {selection && <Badge tone="blue">{selection.text.trim() ? `${selection.text.trim().split(/\s+/).length} words selected` : 'No selection'}</Badge>}
          </div>
          {!suggestion ? <>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Select a sentence in the draft (or place the cursor in a paragraph) and generate a reviewable suggestion. Nothing changes until you apply it.</p>
            <Field label="Style" className="mt-2">
              <Select value={rewritePreset} onChange={(event) => setRewritePreset(event.target.value)}>
                {REWRITE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </Select>
            </Field>
            <div className="mt-2 flex gap-1">
              <Button size="sm" variant={rewriteEngine === 'local' ? 'primary' : 'secondary'} className="flex-1" onClick={() => setRewriteEngine('local')}>Local rules</Button>
              <Button size="sm" variant={rewriteEngine === 'ollama' ? 'primary' : 'secondary'} className="flex-1" onClick={() => setRewriteEngine('ollama')}>Ollama</Button>
            </div>
            {rewriteEngine === 'ollama' && <div className="mt-2 space-y-2">
              <Field label="Endpoint" hint="Browser-local only.">
                <Input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} spellCheck={false} />
              </Field>
              <Field label="Model">
                <Input value={model} onChange={(event) => setModel(event.target.value)} spellCheck={false} />
              </Field>
              <p className="text-[9px] leading-relaxed text-slate-400">The selected text is sent only when you generate. Protected values are verified before a suggestion can be accepted.</p>
            </div>}
            <Button size="sm" variant="primary" className="mt-2 w-full" disabled={!active || rewriteBusy} onClick={generateSuggestion} icon={<Sparkles size={12} />}>
              {rewriteBusy ? 'Rewriting…' : 'Suggest rewrite'}
            </Button>
            {selection && <div className="mt-2 max-h-20 overflow-auto rounded-lg bg-slate-50 p-2 text-[9.5px] leading-relaxed text-slate-500">{selection.text.slice(0, 320)}{selection.text.length > 320 ? '…' : ''}</div>}
          </> : <>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={suggestion.engine === 'local' ? 'green' : 'blue'}>{suggestion.engine === 'local' ? 'Local rules' : 'Ollama'}</Badge>
              <Badge tone="slate">{REWRITE_PRESETS.find((preset) => preset.id === suggestion.preset)?.label || suggestion.preset}</Badge>
              {changeSummary && <Badge tone={changeSummary.wordDelta <= 0 ? 'green' : 'slate'}>{changeSummary.wordDelta > 0 ? '+' : ''}{changeSummary.wordDelta} words</Badge>}
              <button type="button" onClick={() => { setSuggestion(null); setDecisions({}) }} className="ml-auto text-slate-400 hover:text-slate-700" aria-label="Discard suggestion"><X size={13} /></button>
            </div>
            <div className="mt-2 max-h-[42vh] space-y-2 overflow-auto pr-1">
              {suggestion.diff.groups.map((group: { id: string; before: string; after: string }, index: number) => {
                const accepted = decisions[group.id] !== false
                return <div key={group.id} className={`rounded-lg border p-2 ${accepted ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="mb-1.5 flex items-center gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Change {index + 1}</span>
                    <div className="ml-auto flex gap-1">
                      <button type="button" onClick={() => setDecisions((current) => ({ ...current, [group.id]: true }))} className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${accepted ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 hover:text-emerald-600'}`}>Accept</button>
                      <button type="button" onClick={() => setDecisions((current) => ({ ...current, [group.id]: false }))} className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${!accepted ? 'bg-slate-600 text-white' : 'bg-white text-slate-500 hover:text-slate-700'}`}>Reject</button>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <div className="rounded bg-rose-50 px-2 py-1 text-[9.5px] leading-relaxed text-rose-700 line-through">{group.before || '(no original text)'}</div>
                    <div className="rounded bg-emerald-50 px-2 py-1 text-[9.5px] leading-relaxed text-emerald-700">{group.after || '(text removed)'}</div>
                  </div>
                </div>
              })}
            </div>
            <div className="mt-2 flex items-center gap-1">
              <Button size="sm" variant="primary" className="flex-1" onClick={applySuggestion} icon={<Check size={12} />}>Apply accepted</Button>
              <Button size="sm" variant="ghost" onClick={() => setDecisions(Object.fromEntries(suggestion.diff.groups.map((group: { id: string }) => [group.id, false])))}>Reject all</Button>
            </div>
            <p className="mt-1.5 text-[9px] leading-relaxed text-slate-400">Always verify scientific meaning. Local rules and self-hosted models can sound confident while being wrong.</p>
          </>}
        </Card>

        <Card className="p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700"><Map size={13} className="text-indigo-500" />Claim–evidence map</h2>
            <div className="flex flex-wrap gap-1">
              <Badge tone="green">{claimSummary.supported} supported</Badge>
              {claimSummary.unsupported > 0 && <Badge tone="amber">{claimSummary.unsupported} unchecked</Badge>}
              {claimSummary.stale > 0 && <Badge tone="slate">{claimSummary.stale} stale</Badge>}
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Select a sentence in the draft, add it as a claim, then link saved references as evidence. Nothing is sent anywhere.</p>
          <div className="mt-2 flex gap-1">
            <Button size="sm" variant="primary" className="flex-1" onClick={addClaim} disabled={!active} icon={<Plus size={12} />}>Add selected claim</Button>
            <Button size="sm" variant="secondary" onClick={exportEvidenceMap} disabled={!active} icon={<ArrowDownToLine size={12} />}>Export map</Button>
          </div>
          {claims.length ? <div className="mt-2 max-h-[42vh] space-y-2 overflow-auto pr-1">
            {claims.map((claim) => {
              const status = claimStatus(claim, active?.content || '', references)
              const tone = status.stale ? 'slate' : status.supported ? 'green' : 'amber'
              return <div key={claim.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                <div className="flex items-start gap-1.5">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                  <p className="min-w-0 flex-1 text-[9.5px] leading-relaxed text-slate-600">&ldquo;{claim.text.slice(0, 180)}{claim.text.length > 180 ? '…' : ''}&rdquo;</p>
                  <button type="button" onClick={() => removeClaim(claim.id)} className="shrink-0 text-slate-300 hover:text-red-500" aria-label={`Remove claim: ${claim.text.slice(0, 40)}`}><X size={12} /></button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <Badge tone={tone}>{status.stale ? 'Stale' : status.supported ? 'Supported' : 'Unchecked'}</Badge>
                  {claim.section && <Badge tone="blue">{claim.section}</Badge>}
                </div>
                {status.linkedIds.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">
                  {status.linkedIds.map((id: string) => <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[9px] text-emerald-700">
                    <Link2 size={9} className="shrink-0" />
                    <span className="truncate">{referenceLabel(references.find((reference) => reference.id === id))}</span>
                    <button type="button" onClick={() => unlinkReference(claim.id, id)} aria-label={`Unlink ${references.find((reference) => reference.id === id)?.title || 'reference'}`} className="text-emerald-400 hover:text-red-500"><X size={9} /></button>
                  </span>)}
                </div>}
                {references.length > 0 && <div className="mt-1.5 flex gap-1">
                  <Select value={claimChoice[claim.id] || ''} onChange={(event) => setClaimChoice((current) => ({ ...current, [claim.id]: event.target.value }))} className="!h-7 !rounded-lg !px-2 !text-[9.5px]" aria-label={`Evidence for claim: ${claim.text.slice(0, 40)}`}>
                    <option value="">Choose a saved reference…</option>
                    {references.map((reference) => <option key={reference.id} value={reference.id}>{referenceLabel(reference).slice(0, 80)}</option>)}
                  </Select>
                  <Button size="sm" variant="secondary" className="!h-7 !px-2" onClick={() => linkReference(claim.id)} disabled={!claimChoice[claim.id]} icon={<Link2 size={10} />}>Link</Button>
                </div>}
              </div>
            })}
          </div> : <p className="mt-2 text-[10px] leading-relaxed text-slate-400">No claims tracked yet. Stale claims are those whose text no longer appears in the draft; they stay in the exported map as a separate list.</p>}
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between"><h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700"><Sparkles size={13} className="text-blue-500" />Writing checks</h2><Badge tone="blue">rule-based</Badge></div>
          <div className="mt-2 space-y-1.5">
            <CheckRow label="Readability" value={stats.flesch === null ? '—' : `${Math.round(stats.flesch)} · ${readabilityLabel(stats.flesch)}`} good={stats.flesch === null || stats.flesch >= 50} />
            <CheckRow label="Avg. sentence" value={`${stats.averageSentenceLength.toFixed(1)} words`} good={stats.averageSentenceLength > 0 && stats.averageSentenceLength <= 25} />
            <CheckRow label="Long sentences" value={longSentenceList.length ? `${stats.longSentences.length} over 30 words` : 'No long sentences'} good={!stats.longSentences.length} />
            <CheckRow label="Repeated terms" value={stats.repeated.length ? stats.repeated.map(([word, count]: [string, number]) => `${word} (${count})`).join(', ') : 'None above threshold'} good={!stats.repeated.length} />
            <CheckRow label="Filler phrases" value={stats.fillers.length ? stats.fillers.map((entry: { phrase: string; count: number }) => `${entry.phrase} (${entry.count})`).join(', ') : 'None detected'} good={!stats.fillers.length} />
            <CheckRow label="Possible passive voice" value={stats.passiveCount ? `${stats.passiveCount} phrase(s); review in context` : 'No simple patterns found'} good={!stats.passiveCount} />
            <CheckRow label="In-text citations" value={`${stats.citationCount} author–year pattern(s)`} good={stats.citationCount > 0} neutral={!stats.wordCount} />
            <CheckRow label="Markdown headings" value={stats.headingCount ? `${stats.headingCount} heading(s)` : 'None'} good={stats.headingCount > 0} neutral={!stats.wordCount} />
            <CheckRow label="Claim evidence" value={claimSummary.total ? `${claimSummary.supported}/${claimSummary.total} supported${claimSummary.stale ? ` · ${claimSummary.stale} stale` : ''}` : 'No claims tracked'} good={claimSummary.total > 0 && claimSummary.supported === claimSummary.total && claimSummary.stale === 0} neutral={claimSummary.total === 0} />
          </div>
          <Callout tone="warning">These heuristics can produce false positives. They are not a grammar checker and cannot reliably detect AI-generated text.</Callout>
        </Card>

        {longSentenceList.length > 0 && <Card className="p-3.5">
          <h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700"><TriangleAlert size={13} className="text-amber-500" />Consider splitting</h2>
          <ul className="mt-2 space-y-2">
            {longSentenceList.map((sentence: { index: number; words: number; text: string }) => <li key={sentence.index} className="rounded-md bg-slate-50 p-2 text-[9.5px] leading-relaxed text-slate-500">Sentence {sentence.index} · {sentence.words} words<br /><span className="line-clamp-3">{sentence.text.slice(0, 220)}{sentence.text.length > 220 ? '…' : ''}</span></li>)}
          </ul>
        </Card>}

        <Card className="p-3.5">
          <h2 className="text-xs font-extrabold text-slate-700">Document tools</h2>
          <div className="mt-2 grid gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => documentInputRef.current?.click()} disabled={importBusy} icon={<FileUp size={12} />}>{importBusy ? 'Importing…' : 'Import .docx / .md / .txt'}</Button>
            <Button size="sm" variant="secondary" onClick={() => setPasteOpen(true)} disabled={!active} icon={<ClipboardPaste size={12} />}>Paste from Word / Docs</Button>
            <Button size="sm" variant="secondary" onClick={() => void exportDraft('docx')} disabled={!active || exportBusy} icon={<FileDown size={12} />}>Word file (.docx)</Button>
            <Button size="sm" variant="secondary" onClick={() => void exportDraft('md')} disabled={!active || exportBusy} icon={<ArrowDownToLine size={12} />}>Markdown (.md)</Button>
            <Button size="sm" variant="secondary" onClick={() => void exportDraft('txt')} disabled={!active || exportBusy} icon={<ArrowDownToLine size={12} />}>Plain text (.txt)</Button>
            <Button size="sm" variant="ghost" onClick={copyDraft} disabled={!active} icon={<Copy size={12} />}>Copy all text</Button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => imageInputRef.current?.click()} disabled={!active} title="Insert local image" icon={<ImagePlus size={12} />}>Image</Button>
            <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={!active} title="Attach local file" icon={<Paperclip size={12} />}>File</Button>
            <Button size="sm" variant="ghost" onClick={() => setAssetOpen(true)} disabled={!active} title="Insert saved visual asset" icon={<ImageIcon size={12} />}>Assets</Button>
          </div>
          <Callout tone="info">Word and Google Docs are handled through exported files or clipboard paste. There is no Google Drive sign-in or live co-editing. Complex layouts such as track changes, footnotes, columns and equations may not survive the Markdown-based round trip.</Callout>
          <p className="mt-2 text-[9px] leading-relaxed text-slate-400">Drafts and inserted assets autosave to IndexedDB and keep bounded version snapshots. Exports embed saved assets up to 8 MB each; export regularly if browser site data may be cleared.</p>
        </Card>
      </aside>
    </div>

    <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Insert link"
      footer={<>
        <Button variant="ghost" onClick={() => setLinkOpen(false)}>Cancel</Button>
        <Button variant="primary" onClick={insertLink} icon={<Link2 size={12} />}>Insert link</Button>
      </>}>
      <p className="text-[11px] leading-relaxed text-slate-500">Use an http(s), mailto, relative path or a saved <code>asset://</code> link. JavaScript and HTML data URLs are rejected.</p>
      <Field label="Display text" className="mt-3"><Input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Link text or selected text" /></Field>
      <Field label="Destination" className="mt-2"><Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.org/paper" spellCheck={false} /></Field>
    </Modal>

    <Modal open={pasteOpen} onClose={() => setPasteOpen(false)} title="Paste from Word or Google Docs" wide
      footer={<>
        <Button variant="ghost" onClick={() => setPasteOpen(false)}>Cancel</Button>
        <Button variant="secondary" onClick={() => insertPasted('insert')} disabled={!pasteMarkdown.trim()} icon={<Plus size={12} />}>Insert at cursor</Button>
        <Button variant="primary" onClick={() => insertPasted('replace')} disabled={!pasteMarkdown.trim()} icon={<ClipboardPaste size={12} />}>Replace draft</Button>
      </>}>
      <Callout tone="info">Click the box below and press Ctrl/Cmd+V. SciVeyra reads formatted clipboard HTML when available, converts it to reviewable Markdown, and never contacts Google or Microsoft.</Callout>
      <div contentEditable suppressContentEditableWarning role="textbox" aria-label="Paste area" aria-multiline="true"
        onPaste={pasteHtml}
        className="mt-3 min-h-[100px] rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 text-[12px] leading-relaxed text-slate-600 outline-none focus:border-blue-400" />
      {pasteHint && <p className="mt-1.5 text-[10px] leading-relaxed text-emerald-700">{pasteHint}</p>}
      <Field label="Converted draft text" hint="Edit this before inserting if Word or Docs added unwanted styling." className="mt-3">
        <textarea value={pasteMarkdown} onChange={(event) => setPasteMarkdown(event.target.value)} rows={9}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 font-serif text-[12px] leading-relaxed text-slate-700 outline-none focus:border-blue-400"
          placeholder="Pasted content appears here as Markdown…" aria-label="Converted draft text" />
      </Field>
    </Modal>

    <Modal open={assetOpen} onClose={() => setAssetOpen(false)} title="Insert a saved SciVeyra asset" wide>
      {assets.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => <button key={asset.id} type="button" onClick={() => insertSavedAsset(asset)} className="rounded-lg border border-slate-200 p-2 text-left transition hover:border-blue-300 hover:bg-blue-50/40">
          <div className="grid h-20 place-items-center overflow-hidden rounded bg-slate-50">
            {asset.kind === 'file' ? <Paperclip size={22} className="text-slate-400" />
              : <img src={assetPreviewSrc(asset)} alt="" className="max-h-20 max-w-full object-contain" />}
          </div>
          <div className="mt-1 truncate text-[10px] font-bold text-slate-700">{asset.name}</div>
          <div className="text-[9px] text-slate-400">{asset.kind.toUpperCase()} · {asset.kind === 'file' ? 'link' : 'image'}</div>
        </button>)}
      </div> : <Callout tone="info">No saved assets yet. Export a graph from Graph Studio, trace in Vector Studio, or insert a local image above; it will appear here for reuse.</Callout>}
      <p className="mt-2 text-[9px] leading-relaxed text-slate-400">Images and files are stored once in SciVeyra assets. Drafts keep a small reference, and exports embed the stored data when possible.</p>
    </Modal>
  </div>
}

function assetPreviewSrc(asset: Asset) {
  if (!asset.data) return ''
  if (asset.data.startsWith('data:')) return asset.data
  if (asset.kind === 'svg') return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(asset.data)))}`
  return asset.data
}

function CheckRow({ label, value, good, neutral = false }: { label: string; value: string; good: boolean; neutral?: boolean }) {
  return <div className="flex gap-2 border-b border-slate-100 py-1.5 last:border-0">
    <span className={`mt-0.5 shrink-0 ${neutral ? 'text-slate-300' : good ? 'text-emerald-500' : 'text-amber-500'}`}>{neutral ? <FileText size={11} /> : good ? <Check size={11} /> : <TriangleAlert size={11} />}</span>
    <div className="min-w-0"><div className="text-[10px] font-bold text-slate-600">{label}</div><div className="break-words text-[9px] leading-relaxed text-slate-400">{value}</div></div>
  </div>
}
