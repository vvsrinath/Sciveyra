import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine, ArrowRight, BookOpen, Check, Database, ExternalLink, Fingerprint,
  Loader2, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, TriangleAlert
} from 'lucide-react'
import { Badge, Button, Callout, Card, Field, Input, PageHeader, Select, Spinner, Toggle } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { dbGetAll, dbPut, getSetting, setSetting } from '../../lib/storage.js'
import { exportBibTeX, findDuplicate, normalizeReference } from '../../lib/references.js'
import { downloadText } from '../../lib/export.js'
import { enrichWithUnpaywall, ipPatternLinks, OA_SOURCES, searchOpenAccess } from '../../lib/metadata.js'
import {
  cacheKey, expandSources, isFresh, isStale, readCacheEntry,
  summarizeSourceHealth, writeCacheEntry
} from '../../lib/searchCache.js'
import { formatRelative, nowIso } from '../../lib/util.js'
import type { Reference } from '../../types'

type Result = {
  key: string
  title: string
  authors: string[]
  year: string
  journal: string
  doi: string
  url: string
  oaUrl: string
  type: string
  abstract: string
  source: string
  isOa: boolean
  isReview: boolean
  isPeerReviewed: boolean
  publisher: string
  note: string
}

type SourceId = 'openalex' | 'crossref' | 'doaj' | 'europepmc' | 'arxiv' | 'peerreviewed'
type SearchState = { results: Result[]; errors: string[]; sources: string[] }
type CacheStatus = 'fresh' | 'stale' | 'live'
type CacheInfo = { key: string; status: CacheStatus; fetchedAt: string; fromCache: boolean }

const SUGGESTIONS = ['XRD analysis nanomaterials', 'plastic pyrolysis oil engine performance', 'machine learning materials discovery', 'peer reviewed review battery recycling']
const DEFAULT_SOURCES: SourceId[] = ['peerreviewed']

export default function ResearchNavigator() {
  const { notify, refreshToken, bumpRefresh } = useApp()
  const [query, setQuery] = useState('')
  const [sources, setSources] = useState<SourceId[]>(DEFAULT_SOURCES)
  const [rows, setRows] = useState('10')
  const [email, setEmail] = useState('')
  const [reviewOnly, setReviewOnly] = useState(true)
  const [oaOnly, setOaOnly] = useState(true)
  const [search, setSearch] = useState<SearchState>({ results: [], errors: [], sources: [] })
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null)
  const [attemptedSources, setAttemptedSources] = useState<string[]>([])
  const [saved, setSaved] = useState<Reference[]>([])
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [savingKey, setSavingKey] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [references, storedEmail] = await Promise.all([
          dbGetAll('references') as Promise<Reference[]>,
          getSetting('unpaywallEmail', '') as Promise<string>
        ])
        setSaved(references)
        setSavedKeys(new Set(references.map((reference) => reference.doi.toLowerCase()).filter(Boolean)))
        if (storedEmail) setEmail(storedEmail)
      } catch {
        /* ignore */
      }
    })()
  }, [refreshToken])

  const links = useMemo(() => ipPatternLinks(query), [query])

  const visibleResults = useMemo(() => search.results.filter((result) => {
    if (reviewOnly && !result.isReview) return false
    if (oaOnly && !result.isOa && !result.oaUrl) return false
    return true
  }), [search.results, reviewOnly, oaOnly])

  const currentKey = useMemo(() => cacheKey(query, sources, rows), [query, sources, rows])
  const sourceHealth = useMemo(() => summarizeSourceHealth({
    attempted: attemptedSources,
    sources: search.sources,
    errors: search.errors,
    results: search.results
  }), [attemptedSources, search.sources, search.errors, search.results])
  const activeCache = cacheInfo?.key === currentKey ? cacheInfo : null

  const toggleSource = (id: SourceId) => {
    setSources((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const runSearch = async (searchQuery = query, options: { bypassCache?: boolean } = {}) => {
    const trimmed = searchQuery.trim()
    if (!trimmed) { notify('Enter a topic, author or DOI to search.', 'warning'); return }
    if (!sources.length) { notify('Choose at least one metadata source.', 'warning'); return }
    const key = cacheKey(trimmed, sources, rows)
    const attempted = expandSources(sources)
    setLoading(true)
    setHasSearched(true)
    setSearch({ results: [], errors: [], sources: [] })
    setCacheInfo(null)
    setAttemptedSources(attempted)
    await setSetting('unpaywallEmail', email.trim()).catch(() => {})
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 45000)
    let cached: any = null

    // Unpaywall is always applied here, never before caching, so the current
    // browser-local email can change without invalidating the cache key.
    const enrich = async (results: Result[]) => {
      if (!email.trim()) return { results, errors: [] as string[] }
      try {
        const payload = await enrichWithUnpaywall(results, email.trim(), { signal: controller.signal })
        return {
          results: (Array.isArray(payload?.results) ? payload.results : results) as Result[],
          errors: (Array.isArray(payload?.errors) ? payload.errors : []) as string[]
        }
      } catch {
        return { results, errors: [] as string[] }
      }
    }

    const serveCached = async (status: 'fresh' | 'stale') => {
      const fetchedAt = String(cached.fetchedAt || cached.updatedAt || cached.createdAt || nowIso())
      const enriched = await enrich(Array.isArray(cached.results) ? cached.results : [])
      setSearch({
        results: enriched.results,
        sources: Array.isArray(cached.sources) ? cached.sources : [],
        errors: enriched.errors
      })
      setAttemptedSources(Array.isArray(cached.sourceIds) && cached.sourceIds.length ? cached.sourceIds : attempted)
      setCacheInfo({ key, status, fetchedAt, fromCache: true })
      notify(
        status === 'stale'
          ? `Live sources were unavailable; showing results cached ${formatRelative(fetchedAt).toLowerCase()}. Refresh sources to retry.`
          : `Loaded ${enriched.results.length} cached record(s) from ${formatRelative(fetchedAt).toLowerCase()}. Refresh sources to check live data.`,
        status === 'stale' ? 'warning' : 'info'
      )
    }

    const fail = (message: string) => {
      setSearch({ results: [], errors: [message], sources: [] })
      notify(message, 'error')
    }

    try {
      cached = await readCacheEntry(key)
      const canUseFresh = Boolean(cached && isFresh(cached) && !options.bypassCache)
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false

      if (offline) {
        if (cached) await serveCached(canUseFresh ? 'fresh' : 'stale')
        else fail('You are offline and no cached results exist for this search. Reconnect and try again.')
        return
      }
      if (canUseFresh) { await serveCached('fresh'); return }

      const payload = await searchOpenAccess(trimmed, sources, {
        rows: Math.max(1, Math.min(30, Number(rows) || 10)),
        signal: controller.signal,
        enrichOa: false
      }) as SearchState
      const sourcesFailed = payload.errors.length > 0 && payload.results.length === 0

      if (sourcesFailed && cached) { await serveCached('stale'); return }
      if (sourcesFailed) { fail(payload.errors.join(' · ') || 'The providers could not be reached.'); return }

      const enriched = await enrich(payload.results)
      setSearch({
        results: enriched.results,
        sources: payload.sources || [],
        errors: [...payload.errors, ...enriched.errors]
      })
      setCacheInfo({ key, status: 'live', fetchedAt: nowIso(), fromCache: false })
      if (!payload.errors.length) {
        try {
          await writeCacheEntry(key, {
            results: payload.results,
            sources: payload.sources,
            errors: [],
            query: trimmed
          }, { sourceIds: sources, rows })
        } catch { /* the cache is best-effort */ }
      }
      notify(
        enriched.results.length
          ? `Loaded ${enriched.results.length} record(s) from ${payload.sources.length || 'public metadata'} source(s). Verify before citing.`
          : 'No matching open-access records were returned. Try broader terms or another source.',
        enriched.results.length ? 'success' : 'info'
      )
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The providers could not be reached.'
      if (cached && (isFresh(cached) || isStale(cached))) await serveCached('stale')
      else fail(message)
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
        url: result.oaUrl || result.url,
        type: result.type === 'preprint' ? 'other' : result.type === 'review' ? 'article' : result.type,
        abstract: result.abstract.slice(0, 8000),
        source: `${result.source}${result.oaUrl ? ' · OA' : ''}`,
        notes: [result.note, result.isReview ? 'Classified as a review by source metadata.' : ''].filter(Boolean).join(' ')
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
    <PageHeader eyebrow="LITERATURE / REFERENCE FINDER" title="Reference Finder" description="Search free, open-access metadata across scholarly indexes and save verified records to your local library."
      actions={<>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-white/70 px-3 py-1.5 text-[10px] font-bold text-emerald-700 backdrop-blur"><ShieldCheck size={13} /> Local library · {localCount}</span>
        <Button variant="secondary" onClick={exportLibrary} icon={<ArrowDownToLine size={14} />}>Export BibTeX</Button>
      </>}
    />

    <Card className="mb-3 p-4">
      <form onSubmit={(event) => { event.preventDefault(); runSearch() }}>
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/75 px-3 py-2 backdrop-blur">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics, authors, DOI or review title…" aria-label="Search open-access metadata" className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" />
          </div>
          <Button type="submit" variant="primary" disabled={loading} icon={loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}>{loading ? 'Searching…' : 'Find papers'}</Button>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-slate-500"><SlidersHorizontal size={13} /> Sources</span>
            <div className="flex gap-2 text-[10px] font-bold">
              <button type="button" onClick={() => setSources(OA_SOURCES.map((source) => source.id as SourceId))} className="text-blue-600 hover:underline">Select all</button>
              <button type="button" onClick={() => setSources(DEFAULT_SOURCES)} className="text-slate-400 hover:text-slate-700">Reset</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {OA_SOURCES.map((source) => {
              const active = sources.includes(source.id as SourceId)
              return <button key={source.id} type="button" onClick={() => toggleSource(source.id as SourceId)} title={source.note}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-bold transition ${active ? 'border-blue-300 bg-white text-blue-700 shadow-[0_1px_3px_rgba(15,23,42,.08)]' : 'border-slate-200/80 bg-white/60 text-slate-500 hover:border-slate-300'}`}>
                {active ? <Check size={11} /> : <span className="h-2.5 w-2.5 rounded-full border border-slate-300" />}
                {source.label}
              </button>
            })}
          </div>
          <p className="mt-2 text-[9.5px] leading-relaxed text-slate-400">“Peer-reviewed journals” queries OpenAlex, DOAJ, Europe PMC and Crossref together. arXiv results are labelled preprints.</p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Results per source"><Select value={rows} onChange={(event) => setRows(event.target.value)} className="h-9">{['5', '10', '20', '30'].map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
          <Field label="Unpaywall email" hint="Optional. Use your own email to resolve OA links; it is stored only in this browser."><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@institution.edu" className="h-9" /></Field>
          <div className="flex flex-col justify-center gap-1 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 backdrop-blur">
            <Toggle checked={reviewOnly} onChange={setReviewOnly} label="Reviews only" />
            <Toggle checked={oaOnly} onChange={setOaOnly} label="Open access only" />
          </div>
          <div className="flex flex-wrap items-center content-center gap-1.5">
            {SUGGESTIONS.slice(0, 3).map((suggestion) => <button key={suggestion} type="button" onClick={() => { setQuery(suggestion); runSearch(suggestion) }} className="rounded-lg border border-slate-200/80 bg-white/70 px-2 py-1.5 text-[9.5px] font-semibold text-slate-500 transition hover:border-blue-300 hover:text-blue-600">{suggestion}</button>)}
          </div>
        </div>
      </form>

      {search.errors.length > 0 && <div className="mt-3 space-y-1.5">{search.errors.map((error, index) => <Callout key={`${error}-${index}`} tone="warning">{error}</Callout>)}</div>}

      {activeCache && <div className="mt-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-slate-500"><Database size={13} /> Search cache</span>
          {activeCache.status === 'live' ? <Badge tone="blue">Live</Badge> : activeCache.status === 'fresh' ? <Badge tone="green">Fresh</Badge> : <Badge tone="amber">Stale</Badge>}
          {activeCache.fromCache && <Badge tone="slate">cached results</Badge>}
          <span className="text-[10px] text-slate-500">{formatRelative(activeCache.fetchedAt)}</span>
          <Button size="sm" variant="ghost" className="ml-auto" disabled={loading} icon={<RefreshCw size={12} />} onClick={() => runSearch(query, { bypassCache: true })}>Refresh sources</Button>
        </div>
        {sourceHealth.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
          {sourceHealth.map((item) => <span key={item.id || `general-${item.message}`} title={item.message || undefined}
            className={`max-w-[240px] truncate rounded-md border px-2 py-1 text-[9.5px] font-semibold ${item.status === 'error' ? 'border-red-200 bg-red-50 text-red-700' : item.status === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
            {item.label}{item.status === 'ok' ? ` · ${item.count} result${item.count === 1 ? '' : 's'}` : item.status === 'error' ? ` · error: ${item.message || 'failed'}` : ' · no results'}
          </span>)}
        </div>}
      </div>}

      {activeCache?.status === 'stale' && <div className="mt-3"><Callout tone="warning">Live providers could not be reached. These results come from the local cache and may be out of date. Use “Refresh sources” to retry.</Callout></div>}
    </Card>

    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="min-w-0 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">Search results</h2>
            <p className="mt-0.5 text-[10px] text-slate-500">{hasSearched ? `${visibleResults.length} shown · ${search.results.length} returned` : 'Choose sources and search to begin'} · verify every record before citing</p>
          </div>
          {activeCache?.fromCache && <Badge tone="amber">cached</Badge>}
          {search.sources.length > 0 && <Badge tone="blue">{search.sources.join(' + ')}</Badge>}
        </div>

        {loading ? <div className="grid min-h-[220px] place-items-center"><Spinner label="Contacting public metadata providers…" /></div>
          : visibleResults.length ? <div className="divide-y divide-slate-100">
            {visibleResults.map((result) => {
              const isSaved = Boolean(result.doi && savedKeys.has(result.doi.toLowerCase()))
              return <article key={result.key} className="py-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-blue-50/70 text-blue-500"><BookOpen size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[11.5px] font-extrabold leading-snug text-slate-700">{result.title}</h3>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{[result.authors.slice(0, 6).join(', '), result.authors.length > 6 ? 'et al.' : '', result.year, result.journal].filter(Boolean).join(' · ') || 'Author and venue metadata unavailable'}</p>
                    {result.abstract && <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-400">{result.abstract.slice(0, 320)}{result.abstract.length > 320 ? '…' : ''}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="slate">{result.source}</Badge>
                      {result.isReview && <Badge tone="blue">review</Badge>}
                      {result.isOa && <Badge tone="green">open access</Badge>}
                      {result.isPeerReviewed && <Badge tone="green">peer reviewed</Badge>}
                      {result.type === 'preprint' && <Badge tone="amber">preprint</Badge>}
                      {result.doi && <a href={`https://doi.org/${result.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-blue-600 hover:underline">DOI: {result.doi} <ExternalLink size={10} /></a>}
                      {result.oaUrl && <a href={result.oaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-emerald-600 hover:underline">Full text <ExternalLink size={10} /></a>}
                      {!result.doi && result.url && <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-blue-600 hover:underline">Open record <ExternalLink size={10} /></a>}
                    </div>
                  </div>
                  <Button size="sm" variant={isSaved ? 'secondary' : 'primary'} disabled={isSaved || savingKey === result.key} onClick={() => saveReference(result)} icon={isSaved ? <Check size={12} /> : <Plus size={12} />}>{isSaved ? 'Saved' : savingKey === result.key ? 'Saving…' : 'Save'}</Button>
                </div>
              </article>
            })}
          </div> : <div className="grid min-h-[260px] place-items-center">
            <div className="max-w-md text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-blue-100 bg-blue-50/70 text-blue-500"><Search size={20} /></div>
              <h3 className="mt-3 text-sm font-extrabold text-slate-700">{hasSearched ? 'No records matched these filters.' : 'Find open research, honestly.'}</h3>
              <p className="mx-auto mt-1 max-w-sm text-[10px] leading-relaxed text-slate-500">{hasSearched ? 'Try broader terms, turn off Reviews only, or add more sources. You can also import a BibTeX/RIS file in Reference Manager.' : 'Search public metadata, check the original source, then save only the records you need.'}</p>
            </div>
          </div>}
      </Card>

      <aside className="space-y-3">
        <Card className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><Fingerprint size={15} className="text-violet-500" /> IPs & pattern references</h2>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">No keyless browser-safe patent API was available, so these open external search portals. Verify results at the source and add references manually.</p>
          <div className="mt-3">
            <div className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Patents / IP</div>
            <div className="space-y-1">
              {links.patents.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white/60 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-violet-300 hover:text-violet-700">{link.label}<ExternalLink size={11} /></a>)}
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Pattern references</div>
            <div className="space-y-1">
              {links.patterns.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white/60 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700">{link.label}<ExternalLink size={11} /></a>)}
            </div>
          </div>
          <p className="mt-3 text-[9px] leading-relaxed text-slate-400">{query ? `Links include your current query: “${query}”.` : 'Enter a topic above to build query-specific links.'}</p>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-extrabold text-slate-800">Search honestly</h2>
          <ul className="mt-2 space-y-2 text-[10px] leading-relaxed text-slate-500">
            <li className="flex gap-2"><TriangleAlert size={12} className="mt-0.5 shrink-0 text-amber-500" />Review/OA flags come from provider metadata and can be wrong or missing.</li>
            <li className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />Saved records live in your local IndexedDB library.</li>
            <li className="flex gap-2"><ShieldCheck size={12} className="mt-0.5 shrink-0 text-blue-500" />A recent local cache may be shown instead of contacting providers. Unpaywall is called only with your own email, and its links are never cached.</li>
          </ul>
          <Link to="/references" className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline">Manage saved references <ArrowRight size={11} /></Link>
        </Card>
      </aside>
    </div>
  </div>
}
