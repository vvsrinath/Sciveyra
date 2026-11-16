import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine, ArrowRight, BookOpen, Check, ExternalLink, Loader2, Plus, Search, ShieldCheck, TriangleAlert
} from 'lucide-react'
import { Badge, Button, Callout, Card, Field, Input, PageHeader, Select, Spinner } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { dbGetAll, dbPut } from '../../lib/storage.js'
import { exportBibTeX, findDuplicate, normalizeReference } from '../../lib/references.js'
import { downloadText } from '../../lib/export.js'
import { nowIso } from '../../lib/util.js'
import type { Reference } from '../../types'

type Provider = 'Crossref' | 'Europe PMC'
type Result = {
  key: string
  title: string
  authors: string[]
  year: string
  journal: string
  doi: string
  url: string
  type: string
  abstract: string
  source: Provider
}

const SUGGESTIONS = ['XRD analysis nanomaterials', 'plastic pyrolysis oil engine performance', 'diesel engine emission characteristics', 'machine learning materials discovery']

function stripMarkup(value: string) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

async function searchCrossref(query: string, rows: number, signal: AbortSignal): Promise<Result[]> {
  const response = await fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=${rows}&select=DOI,title,author,container-title,published,issued,type,URL,abstract`, { signal })
  if (!response.ok) throw new Error(`Crossref returned HTTP ${response.status}.`)
  const json = await response.json()
  const items = json?.message?.items || []
  return items.map((item: any) => ({
    key: item.DOI || item.URL || item.title?.[0] || Math.random().toString(36),
    title: item.title?.[0] || 'Untitled record',
    authors: (item.author || []).map((author: any) => [author.given, author.family].filter(Boolean).join(' ') || author.name || '').filter(Boolean),
    year: String(item.published?.['date-parts']?.[0]?.[0] || item.issued?.['date-parts']?.[0]?.[0] || ''),
    journal: item['container-title']?.[0] || '',
    doi: item.DOI || '',
    url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ''),
    type: item.type || 'article',
    abstract: stripMarkup(item.abstract || ''),
    source: 'Crossref' as const
  }))
}

async function searchEuropePmc(query: string, rows: number, signal: AbortSignal): Promise<Result[]> {
  const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${rows}&resultType=core`, { signal })
  if (!response.ok) throw new Error(`Europe PMC returned HTTP ${response.status}.`)
  const json = await response.json()
  const items = json?.resultList?.result || []
  return items.map((item: any) => ({
    key: item.doi || item.id || item.title,
    title: stripMarkup(item.title || 'Untitled record'),
    authors: String(item.authorString || '').split(/,\s*/).map((name) => name.trim()).filter(Boolean),
    year: String(item.pubYear || ''),
    journal: item.journalTitle || item.bookOrReportDetails?.publisher || '',
    doi: item.doi || '',
    url: item.doi ? `https://doi.org/${item.doi}` : `https://europepmc.org/article/${item.source || 'MED'}/${item.id || ''}`,
    type: item.pubType || 'article',
    abstract: stripMarkup(item.abstractText || ''),
    source: 'Europe PMC' as const
  }))
}

export default function ResearchNavigator() {
  const { notify, refreshToken, bumpRefresh } = useApp()
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<Provider>('Crossref')
  const [rows, setRows] = useState('10')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Reference[]>([])
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [savingKey, setSavingKey] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const references = await dbGetAll('references') as Reference[]
        setSaved(references)
        setSavedKeys(new Set(references.map((reference) => reference.doi.toLowerCase()).filter(Boolean)))
      } catch {
        /* ignore */
      }
    })()
  }, [refreshToken])

  const runSearch = async (searchQuery = query) => {
    const trimmed = searchQuery.trim()
    if (!trimmed) { notify('Enter a topic, author or DOI to search.', 'warning'); return }
    setLoading(true)
    setError('')
    setHasSearched(true)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const limit = Math.max(1, Math.min(30, Number(rows) || 10))
      const items = provider === 'Crossref'
        ? await searchCrossref(trimmed, limit, controller.signal)
        : await searchEuropePmc(trimmed, limit, controller.signal)
      setResults(items)
      notify(`Loaded ${items.length} record(s) from ${provider}. Verify metadata before citing.`, items.length ? 'success' : 'info')
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') setError('The request timed out. Try again or import references manually.')
      else setError(caught instanceof Error ? caught.message : 'The provider could not be reached.')
      setResults([])
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }

  const saveReference = async (result: Result) => {
    setSavingKey(result.key)
    try {
      const candidate = normalizeReference({
        title: result.title,
        authors: result.authors,
        year: result.year,
        journal: result.journal,
        doi: result.doi,
        url: result.url,
        type: result.type,
        abstract: result.abstract.slice(0, 8000),
        source: result.source
      })
      const existing = await dbGetAll('references') as Reference[]
      const duplicate = findDuplicate(existing, candidate)
      if (duplicate) {
        notify(`Already in your library: "${duplicate.title}".`, 'warning')
        setSavedKeys((current) => new Set([...current, candidate.doi.toLowerCase()]))
        return
      }
      const record: Reference = { ...candidate, createdAt: nowIso(), updatedAt: nowIso() }
      await dbPut('references', record)
      setSaved((current) => [record, ...current])
      setSavedKeys((current) => new Set([...current, candidate.doi.toLowerCase()]))
      bumpRefresh()
      notify('Reference saved locally. Review the fields in Reference Manager before citing.', 'success')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'The reference could not be saved.', 'error')
    } finally {
      setSavingKey('')
    }
  }

  const exportLibrary = () => {
    if (!saved.length) { notify('Your reference library is empty.', 'warning'); return }
    downloadText(exportBibTeX(saved), 'sciveyra-references.bib', 'application/x-bibtex;charset=utf-8')
    notify(`Exported ${saved.length} reference(s) as BibTeX.`, 'success')
  }

  const localCount = useMemo(() => saved.length, [saved])

  return <div>
    <PageHeader eyebrow="LITERATURE / 01" title="Research Navigator" description="Search public academic metadata, verify each record, then save it to your local library."
      actions={<><span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"><ShieldCheck size={13} /> Local library · {localCount}</span><Button variant="secondary" onClick={exportLibrary} icon={<ArrowDownToLine size={14} />}>Export BibTeX</Button></>}
    />

    <Card className="mb-3 p-4">
      <form onSubmit={(event) => { event.preventDefault(); runSearch() }}>
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics, authors, DOI…" aria-label="Search academic metadata" className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100" />
          </div>
          <Button type="submit" variant="primary" disabled={loading} icon={loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}>{loading ? 'Searching…' : 'Search papers'}</Button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-end gap-3">
          <Field label="Metadata source"><Select value={provider} onChange={(event) => setProvider(event.target.value as Provider)} className="h-8 w-36"><option>Crossref</option><option>Europe PMC</option></Select></Field>
          <Field label="Results"><Select value={rows} onChange={(event) => setRows(event.target.value)} className="h-8 w-24">{['5', '10', '20', '30'].map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
          <div className="pb-1 text-[9.5px] text-slate-400">Direct public metadata request · no AI API · no account</div>
        </div>
      </form>
      {error && <Callout tone="warning">{error}</Callout>}
    </Card>

    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
      <Card className="min-w-0 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Search results</h2><p className="mt-0.5 text-[10px] text-slate-500">{hasSearched ? `${results.length} record(s) returned` : 'Search public metadata to begin'} · verify everything before citing</p></div>
          {results.length > 0 && <Badge tone="blue">{provider}</Badge>}
        </div>
        {loading ? <div className="grid min-h-[220px] place-items-center"><Spinner label={`Contacting ${provider}…`} /></div>
          : results.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {results.map((result) => {
              const isSaved = Boolean(result.doi && savedKeys.has(result.doi.toLowerCase()))
              return <article key={result.key} className="py-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-300"><BookOpen size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[11.5px] font-extrabold leading-snug text-slate-700 dark:text-slate-200">{result.title}</h3>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{[result.authors.slice(0, 6).join(', '), result.authors.length > 6 ? 'et al.' : '', result.year, result.journal].filter(Boolean).join(' · ') || 'Author and venue metadata unavailable'}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {result.doi && <a href={`https://doi.org/${result.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-blue-600 hover:underline dark:text-blue-400">DOI: {result.doi} <ExternalLink size={10} /></a>}
                      {!result.doi && result.url && <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-blue-600 hover:underline dark:text-blue-400">Open record <ExternalLink size={10} /></a>}
                      {result.type && <Badge tone="slate">{result.type}</Badge>}
                    </div>
                  </div>
                  <Button size="sm" variant={isSaved ? 'secondary' : 'primary'} disabled={isSaved || savingKey === result.key} onClick={() => saveReference(result)} icon={isSaved ? <Check size={12} /> : <Plus size={12} />}>{isSaved ? 'Saved' : savingKey === result.key ? 'Saving…' : 'Save'}</Button>
                </div>
              </article>
            })}
          </div> : <div className="grid min-h-[260px] place-items-center">
            <div className="max-w-md text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-300"><Search size={20} /></div>
              <h3 className="mt-3 text-sm font-extrabold text-slate-700 dark:text-slate-200">{hasSearched ? 'No records returned.' : 'Discover research, thoughtfully.'}</h3>
              <p className="mx-auto mt-1 max-w-sm text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{hasSearched ? 'Try broader terms, a different provider, or import a BibTeX/RIS file in Reference Manager.' : 'Search public metadata, check the original source, then save only the records you need.'}</p>
              {!hasSearched && <div className="mt-3 flex flex-wrap justify-center gap-1.5">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => { setQuery(suggestion); runSearch(suggestion) }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9.5px] font-semibold text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{suggestion}<ArrowRight size={11} /></button>)}</div>}
            </div>
          </div>}
      </Card>

      <aside className="space-y-3">
        <Card className="p-4">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Search honestly</h2>
          <ul className="mt-2 space-y-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            <li className="flex gap-2"><TriangleAlert size={12} className="mt-0.5 shrink-0 text-amber-500" />Metadata can be incomplete or wrong. Always verify against the publisher record.</li>
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />Saved records live in your local IndexedDB library.</li>
            <li className="flex gap-2"><ShieldCheck size={12} className="mt-0.5 shrink-0 text-blue-500" />Search requests go directly to {provider}; no proxy or AI service is used.</li>
          </ul>
          <Link to="/references" className="mt-3 inline-flex text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400">Manage saved references →</Link>
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Prefer a file?</h2>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Import BibTeX or RIS exported from a journal, Zotero, Mendeley or your institution.</p>
          <Link to="/references" className="mt-2 inline-flex text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400">Open Reference Manager →</Link>
        </Card>
      </aside>
    </div>
  </div>
}
