import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine, BookOpen, Check, Copy, FileText, Pencil, Plus, Search, ShieldCheck, Sparkles, Trash2, Upload, X
} from 'lucide-react'
import { Badge, Button, Callout, Card, Field, Input, Modal, PageHeader, Select, Spinner } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { dbDelete, dbGetAll, dbPut } from '../../lib/storage.js'
import {
  CITATION_STYLES, CITATION_STYLE_NOTES, dedupeReferences, exportBibTeX, exportRIS, findDuplicate, formatCitation,
  inlineCitation, normalizeReference, parseBibTeX, parseRIS
} from '../../lib/references.js'
import { fetchDoiMetadata, extractDoiFromPdf, lookupByTitle } from '../../lib/metadata.js'
import { copyText, downloadText, readFileAsText } from '../../lib/export.js'
import { nowIso } from '../../lib/util.js'
import type { Reference } from '../../types'

type FormState = {
  id: string
  type: string
  title: string
  authors: string
  year: string
  journal: string
  volume: string
  issue: string
  pages: string
  doi: string
  url: string
  publisher: string
  abstract: string
  notes: string
}

const emptyForm: FormState = {
  id: '', type: 'article', title: '', authors: '', year: '', journal: '', volume: '', issue: '',
  pages: '', doi: '', url: '', publisher: '', abstract: '', notes: ''
}

const TYPE_OPTIONS = [
  ['article', 'Journal article'], ['book', 'Book'], ['chapter', 'Book chapter'], ['conference', 'Conference paper'],
  ['thesis', 'Thesis'], ['report', 'Report'], ['web', 'Web page'], ['other', 'Other']
]

function toForm(reference: Reference): FormState {
  return {
    id: reference.id, type: reference.type, title: reference.title, authors: reference.authors.join('; '),
    year: reference.year, journal: reference.journal, volume: reference.volume, issue: reference.issue,
    pages: reference.pages, doi: reference.doi, url: reference.url, publisher: reference.publisher,
    abstract: reference.abstract, notes: reference.notes
  }
}

export default function ReferenceManager() {
  const { notify, refreshToken, bumpRefresh } = useApp()
  const [references, setReferences] = useState<Reference[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('updated')
  const [style, setStyle] = useState('APA 7')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState('')
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [resolving, setResolving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await dbGetAll('references') as Reference[]
        if (!cancelled) setReferences(list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
      } catch (error) {
        notify(error instanceof Error ? error.message : 'The reference library could not be loaded.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  const openAdd = () => { setForm(emptyForm); setFormError(''); setFormOpen(true) }
  const openEdit = (reference: Reference) => { setForm(toForm(reference)); setFormError(''); setFormOpen(true) }

  const applyReferenceToForm = (incoming: Reference) => {
    setForm((current) => ({
      ...toForm(incoming),
      id: current.id,
      notes: current.notes || incoming.notes,
      abstract: current.abstract || incoming.abstract
    }))
  }

  const resolveDoi = async () => {
    const doi = form.doi.trim()
    if (!doi) { setFormError('Enter a DOI before resolving metadata.'); return }
    setResolving(true)
    setFormError('')
    try {
      const incoming = await fetchDoiMetadata(doi)
      applyReferenceToForm(incoming)
      notify('Metadata filled from Crossref / DataCite. Review before saving.', 'success')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'DOI lookup failed.')
    } finally {
      setResolving(false)
    }
  }

  const resolveTitle = async () => {
    const title = form.title.trim()
    if (title.length < 3) { setFormError('Enter a title to look up.'); return }
    setResolving(true)
    setFormError('')
    try {
      const incoming = await lookupByTitle(title)
      applyReferenceToForm(incoming)
      notify('Best title match filled from Crossref. Verify the details.', 'success')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Title lookup failed.')
    } finally {
      setResolving(false)
    }
  }

  const importPdf = async (file?: File) => {
    if (!file) return
    const reference = normalizeReference({ title: file.name.replace(/\.pdf$/i, ''), source: 'manual' })
    setForm({ ...toForm(reference), id: '' })
    setFormError('')
    setFormOpen(true)
    setResolving(true)
    try {
      const { reference: incoming } = await extractDoiFromPdf(file)
      setForm((current) => ({
        ...toForm(incoming),
        id: current.id,
        title: current.title && current.title !== file.name.replace(/\.pdf$/i, '') ? current.title : incoming.title
      }))
      notify('DOI found in the PDF and metadata filled automatically.', 'success')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The PDF could not be read.')
    } finally {
      setResolving(false)
      if (pdfRef.current) pdfRef.current.value = ''
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    let list = references.filter((reference) => !query || [reference.title, reference.authors.join(' '), reference.year, reference.journal, reference.doi].join(' ').toLowerCase().includes(query))
    if (sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'year') list = [...list].sort((a, b) => (b.year || '0').localeCompare(a.year || '0'))
    else if (sort === 'author') list = [...list].sort((a, b) => (a.authors[0] || '').localeCompare(b.authors[0] || ''))
    else list = [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    return list
  }, [references, search, sort])

  const saveForm = async () => {
    if (!form.title.trim()) { setFormError('A title is required.'); return }
    try {
      const normalized = normalizeReference({
        ...form,
        authors: form.authors.split(/;\s*|\s+and\s+/i),
        source: 'manual',
        createdAt: references.find((reference) => reference.id === form.id)?.createdAt || nowIso()
      })
      const duplicate = findDuplicate(references.filter((reference) => reference.id !== normalized.id), normalized)
      if (duplicate) { setFormError(`A matching record already exists: "${duplicate.title}".`); return }
      const record: Reference = { ...normalized, updatedAt: nowIso() }
      await dbPut('references', record)
      setReferences((current) => [record, ...current.filter((reference) => reference.id !== record.id)])
      setFormOpen(false)
      bumpRefresh()
      notify(form.id ? 'Reference updated.' : 'Reference added to your local library.', 'success')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The reference could not be saved.')
    }
  }

  const remove = async (reference: Reference) => {
    if (!window.confirm(`Delete "${reference.title}" from this browser?`)) return
    try {
      await dbDelete('references', reference.id)
      setReferences((current) => current.filter((item) => item.id !== reference.id))
      setSelected((current) => { const next = new Set(current); next.delete(reference.id); return next })
      bumpRefresh()
      notify('Reference deleted.', 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The reference could not be deleted.', 'error')
    }
  }

  const importFile = async (file?: File) => {
    if (!file) return
    setImporting(true)
    try {
      const text = await readFileAsText(file)
      const extension = file.name.split('.').pop()?.toLowerCase()
      let parsed: Reference[] = []
      const errors: string[] = []
      if (extension === 'ris' || /^TY\s{2}-/m.test(text)) {
        const result = parseRIS(text)
        parsed = result.references
        errors.push(...result.errors)
      } else {
        const result = parseBibTeX(text)
        parsed = result.references
        errors.push(...result.errors)
      }
      const unique = dedupeReferences(parsed)
      const existing = await dbGetAll('references') as Reference[]
      const additions: Reference[] = []
      let skipped = 0
      const known = [...existing]
      for (const candidate of unique) {
        const normalized: Reference = { ...normalizeReference(candidate), updatedAt: nowIso() }
        if (findDuplicate(known, normalized)) { skipped += 1; continue }
        additions.push(normalized)
        known.push(normalized)
      }
      for (const reference of additions) await dbPut('references', reference)
      setReferences((current) => [...additions, ...current])
      bumpRefresh()
      notify(`Imported ${additions.length} reference(s).${skipped ? ` ${skipped} duplicate(s) skipped.` : ''}${errors.length ? ` ${errors.length} parser note(s).` : ''}`, additions.length ? 'success' : 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The file could not be imported. Use BibTeX or RIS.', 'error')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const exportAll = (format: 'bib' | 'ris') => {
    const list = selected.size ? filtered.filter((reference) => selected.has(reference.id)) : filtered
    if (!list.length) { notify('There are no references to export.', 'warning'); return }
    if (format === 'bib') downloadText(exportBibTeX(list), 'sciveyra-library.bib', 'application/x-bibtex;charset=utf-8')
    else downloadText(exportRIS(list), 'sciveyra-library.ris', 'application/x-research-info-systems;charset=utf-8')
    notify(`Exported ${list.length} reference(s) as ${format.toUpperCase()}.`, 'success')
  }

  const copyCitation = async (reference: Reference, inline = false) => {
    try {
      const index = references.findIndex((item) => item.id === reference.id) + 1
      const text = inline ? inlineCitation(reference, index, style) : formatCitation(reference, style, index)
      await copyText(text)
      notify(inline ? 'In-text citation copied.' : `${style} citation copied.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Clipboard access failed.', 'error')
    }
  }

  const toggleSelected = (id: string) => {
    setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((reference) => selected.has(reference.id))

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Spinner label="Opening reference library…" /></div>

  return <div>
    <PageHeader eyebrow="LIBRARY / 01" title="Reference Manager" description="Keep citation metadata organised locally, import BibTeX/RIS, and copy formatted references."
      actions={<>
        <Button variant="secondary" onClick={() => pdfRef.current?.click()} disabled={resolving} icon={<FileText size={14} />}>{resolving ? 'Working…' : 'Add from PDF'}</Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing} icon={<Upload size={14} />}>{importing ? 'Importing…' : 'Import BibTeX / RIS'}</Button>
        <Button variant="primary" onClick={openAdd} icon={<Plus size={14} />}>Add reference</Button>
      </>}
    />
    <input ref={fileRef} type="file" accept=".bib,.ris,.txt" hidden onChange={(event) => importFile(event.target.files?.[0])} aria-label="Import BibTeX or RIS" />
    <input ref={pdfRef} type="file" accept=".pdf,application/pdf" hidden onChange={(event) => importPdf(event.target.files?.[0])} aria-label="Import reference from PDF" />

    <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_160px_180px_auto]">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <Search size={15} className="text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by title, author, year, DOI…" aria-label="Filter references" className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-700 outline-none dark:text-slate-100" />
        {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="text-slate-400"><X size={13} /></button>}
      </div>
      <Field label="Sort"><Select value={sort} onChange={(event) => setSort(event.target.value)} className="h-9"><option value="updated">Recently updated</option><option value="title">Title</option><option value="author">First author</option><option value="year">Year</option></Select></Field>
      <Field label="Citation style"><Select value={style} onChange={(event) => setStyle(event.target.value)} className="h-9">{CITATION_STYLES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
      <div className="flex items-end gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => exportAll('bib')} disabled={!filtered.length} icon={<ArrowDownToLine size={12} />}>BibTeX</Button>
        <Button size="sm" variant="secondary" onClick={() => exportAll('ris')} disabled={!filtered.length} icon={<ArrowDownToLine size={12} />}>RIS</Button>
      </div>
    </div>

    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
      <Card className="min-w-0 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((reference) => reference.id)))} aria-label="Select all visible references" />
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Your references</h2>
            <Badge tone="slate">{filtered.length}{filtered.length !== references.length ? ` / ${references.length}` : ''}</Badge>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500"><ShieldCheck size={12} className="text-emerald-500" /> Stored in this browser only</div>
        </div>

        {filtered.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map((reference) => <article key={reference.id} className="flex items-start gap-2.5 py-3">
            <input type="checkbox" checked={selected.has(reference.id)} onChange={() => toggleSelected(reference.id)} className="mt-1" aria-label={`Select ${reference.title}`} />
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-300"><BookOpen size={14} /></div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[11.5px] font-extrabold leading-snug text-slate-700 dark:text-slate-200">{reference.title}</h3>
              <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{[reference.authors.join(', ') || 'Author not specified', reference.year, reference.journal].filter(Boolean).join(' · ')}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone="slate">{reference.type}</Badge>
                {reference.doi && <a href={`https://doi.org/${reference.doi}`} target="_blank" rel="noreferrer" className="text-[9.5px] font-semibold text-blue-600 hover:underline dark:text-blue-400">{reference.doi}</a>}
                {reference.source && <span className="text-[9px] text-slate-400">source: {reference.source}</span>}
              </div>
              <p className="mt-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-[9.5px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">{formatCitation(reference, style, references.findIndex((item) => item.id === reference.id) + 1)}</p>
              {reference.notes && <p className="mt-1 text-[9.5px] italic text-slate-400">Note: {reference.notes}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <div className="flex gap-0.5">
                <button type="button" onClick={() => copyCitation(reference)} title="Copy formatted citation" aria-label="Copy formatted citation" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"><Copy size={12} /></button>
                <button type="button" onClick={() => openEdit(reference)} title="Edit reference" aria-label="Edit reference" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"><Pencil size={12} /></button>
                <button type="button" onClick={() => remove(reference)} title="Delete reference" aria-label="Delete reference" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"><Trash2 size={12} /></button>
              </div>
              <button type="button" onClick={() => copyCitation(reference, true)} className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400">in-text</button>
            </div>
          </article>)}
        </div> : <div className="grid min-h-[260px] place-items-center text-center">
          <div>
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-300"><BookOpen size={20} /></div>
            <h3 className="mt-3 text-sm font-extrabold text-slate-700 dark:text-slate-200">{references.length ? 'No matching references.' : 'Your library starts here.'}</h3>
            <p className="mx-auto mt-1 max-w-sm text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{references.length ? 'Clear the filter or try another search term.' : 'Import a BibTeX/RIS file, search public metadata in Research Navigator, or add a record manually.'}</p>
            {!references.length && <Button className="mt-3" size="sm" onClick={openAdd} icon={<Plus size={12} />}>Add your first reference</Button>}
          </div>
        </div>}
      </Card>

      <aside className="space-y-3">
        <Card className="p-4">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Citation formatting</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Formatting is deterministic and based only on the fields you store. Always proofread style-specific punctuation before submission.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{CITATION_STYLES.map((item) => <button key={item} type="button" onClick={() => setStyle(item)} className={`rounded-md border px-2 py-1 text-[9.5px] font-bold ${style === item ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`}>{item}</button>)}</div>
          {(CITATION_STYLE_NOTES as Record<string, string>)[style] && <p className="mt-2 text-[9.5px] leading-relaxed text-slate-500 dark:text-slate-400">{(CITATION_STYLE_NOTES as Record<string, string>)[style]}</p>}
          <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-400"><Check size={11} className="text-emerald-500" /> No AI-generated references or citation guesses.</div>
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Library controls</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{selected.size ? `${selected.size} selected. Exports use the selection.` : 'Exports include all currently filtered records.'}</p>
          <div className="mt-2 grid gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => exportAll('bib')} icon={<ArrowDownToLine size={12} />}>Export BibTeX</Button>
            <Button size="sm" variant="secondary" onClick={() => exportAll('ris')} icon={<ArrowDownToLine size={12} />}>Export RIS</Button>
          </div>
        </Card>
        <Callout tone="info">Use Settings to export a full workspace backup. Browser storage can be cleared by the browser or user.</Callout>
      </aside>
    </div>

    <Modal open={formOpen} onClose={() => setFormOpen(false)} title={form.id ? 'Edit reference' : 'Add reference'} wide
      footer={<><Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button><Button variant="primary" onClick={saveForm}>{form.id ? 'Save changes' : 'Add reference'}</Button></>}>
      {formError && <Callout tone="warning">{formError}</Callout>}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" variant="secondary" onClick={resolveTitle} disabled={resolving} icon={<Sparkles size={12} />}>Find metadata by title</Button>
        <span className="text-[9.5px] text-slate-400">Uses the public Crossref API. No AI-generated references or citation guesses.</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2" required><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus /></Field>
        <Field label="Authors" className="sm:col-span-2" hint="Separate authors with semicolons or ' and '."><Input value={form.authors} onChange={(event) => setForm({ ...form, authors: event.target.value })} placeholder="Family, Given; Family, Given" /></Field>
        <Field label="Type"><Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
        <Field label="Year"><Input value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} placeholder="2025" /></Field>
        <Field label="Journal / venue" className="sm:col-span-2"><Input value={form.journal} onChange={(event) => setForm({ ...form, journal: event.target.value })} /></Field>
        <Field label="Volume"><Input value={form.volume} onChange={(event) => setForm({ ...form, volume: event.target.value })} /></Field>
        <Field label="Issue"><Input value={form.issue} onChange={(event) => setForm({ ...form, issue: event.target.value })} /></Field>
        <Field label="Pages"><Input value={form.pages} onChange={(event) => setForm({ ...form, pages: event.target.value })} placeholder="101–115" /></Field>
        <Field label="DOI" hint="Resolve to fill all metadata from Crossref / DataCite.">
          <div className="flex gap-1.5">
            <Input value={form.doi} onChange={(event) => setForm({ ...form, doi: event.target.value })} placeholder="10.xxxx/xxxxx" />
            <Button type="button" size="sm" variant="secondary" onClick={resolveDoi} disabled={resolving} icon={<Sparkles size={12} />}>{resolving ? '…' : 'Resolve'}</Button>
          </div>
        </Field>
        <Field label="URL" className="sm:col-span-2"><Input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} /></Field>
        <Field label="Publisher" className="sm:col-span-2"><Input value={form.publisher} onChange={(event) => setForm({ ...form, publisher: event.target.value })} /></Field>
        <Field label="Abstract / summary" className="sm:col-span-2"><textarea rows={3} value={form.abstract} onChange={(event) => setForm({ ...form, abstract: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></Field>
        <Field label="Your notes" className="sm:col-span-2"><textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></Field>
      </div>
    </Modal>
  </div>
}
