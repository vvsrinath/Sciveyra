import { normalizeReference } from './references.js'

const DOI_REGEX = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/gi

export function normalizeDoi(value) {
  return String(value || '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/[\s.,;]+$/, '')
    .trim()
}

export function parseDoiFromText(text, { fromStart = false } = {}) {
  const source = String(text || '')
  const matches = source.match(DOI_REGEX)
  if (!matches || !matches.length) return ''
  const candidates = matches.map(normalizeDoi).filter((doi) => doi.length > 6)
  if (!candidates.length) return ''
  if (fromStart) {
    const index = source.search(DOI_REGEX)
    return candidates[0] && index >= 0 && index < Math.max(400, source.length * 0.25) ? candidates[0] : candidates[0]
  }
  return candidates[0]
}

function crossrefMessageToData(message) {
  const authors = (message.author || []).map((author) => {
    if (author.name) return author.name
    const given = author.given || ''
    const family = author.family || ''
    return [family, given].filter(Boolean).join(', ')
  }).filter(Boolean)
  const dateParts = message.issued?.['date-parts']?.[0] || message.published?.['date-parts']?.[0] || []
  const year = dateParts[0] ? String(dateParts[0]) : ''
  return {
    title: Array.isArray(message.title) ? message.title[0] : message.title || '',
    authors,
    year,
    journal: Array.isArray(message['container-title']) ? message['container-title'][0] : message['container-title'] || '',
    volume: message.volume || '',
    issue: message.issue || '',
    pages: message.page || '',
    doi: normalizeDoi(message.DOI || ''),
    url: message.URL || (message.DOI ? `https://doi.org/${message.DOI}` : ''),
    publisher: message.publisher || '',
    abstract: stripJats(message.abstract || ''),
    type: mapCrossrefType(message.type),
    source: 'crossref'
  }
}

function dataciteToData(attributes) {
  const creators = (attributes.creators || []).map((creator) => {
    if (creator.name) return creator.name
    const given = creator.givenName || ''
    const family = creator.familyName || ''
    return [family, given].filter(Boolean).join(', ')
  }).filter(Boolean)
  return {
    title: attributes.titles?.[0]?.title || '',
    authors: creators,
    year: String(attributes.publicationYear || ''),
    journal: attributes.container?.title || '',
    volume: attributes.container?.volume || '',
    issue: attributes.container?.issue || '',
    pages: attributes.container?.firstPage ? `${attributes.container.firstPage}${attributes.container.lastPage ? `–${attributes.container.lastPage}` : ''}` : '',
    doi: normalizeDoi(attributes.doi || ''),
    url: attributes.url || (attributes.doi ? `https://doi.org/${attributes.doi}` : ''),
    publisher: attributes.publisher || '',
    abstract: stripJats(attributes.descriptions?.find((entry) => entry.descriptionType === 'Abstract')?.description || ''),
    type: mapDataciteType(attributes.types?.resourceTypeGeneral),
    source: 'datacite'
  }
}

function mapCrossrefType(type) {
  switch ((type || '').toLowerCase()) {
    case 'journal-article': return 'article'
    case 'book': case 'monograph': return 'book'
    case 'book-chapter': return 'chapter'
    case 'proceedings-article': return 'conference'
    case 'dissertation': return 'thesis'
    case 'report': return 'report'
    case 'posted-content': return 'other'
    default: return 'article'
  }
}

function mapDataciteType(type) {
  switch ((type || '').toLowerCase()) {
    case 'journalarticle': case 'text': return 'article'
    case 'book': return 'book'
    case 'bookchapter': return 'chapter'
    case 'conferencepaper': return 'conference'
    case 'dissertation': return 'thesis'
    case 'report': return 'report'
    default: return 'article'
  }
}

function stripJats(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fetch metadata for a single DOI from Crossref, falling back to DataCite.
 * @param {string} doi
 * @param {{ signal?: AbortSignal, mailto?: string }} [options]
 * @returns {Promise<any>}
 */
export async function fetchDoiMetadata(doi, options = {}) {
  const clean = normalizeDoi(doi)
  if (!clean) throw new Error('Enter a DOI, for example 10.1038/nphys1170.')
  const mailto = options.mailto ? `?mailto=${encodeURIComponent(options.mailto)}` : ''
  const errors = []
  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}${mailto}`, {
      signal: options.signal,
      headers: { Accept: 'application/json' }
    })
    if (response.ok) {
      const payload = await response.json()
      if (payload?.message) return normalizeReference(crossrefMessageToData(payload.message))
    } else {
      errors.push(`Crossref responded ${response.status}`)
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Crossref request failed')
  }
  try {
    const response = await fetch(`https://api.datacite.org/dois/${encodeURIComponent(clean)}`, {
      signal: options.signal,
      headers: { Accept: 'application/vnd.api+json' }
    })
    if (response.ok) {
      const payload = await response.json()
      if (payload?.data?.attributes) return normalizeReference(dataciteToData(payload.data.attributes))
    } else {
      errors.push(`DataCite responded ${response.status}`)
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'DataCite request failed')
  }
  throw new Error(`Could not resolve DOI ${clean}. ${errors.join('; ')}. Check the DOI or your connection.`)
}

/**
 * Extract text from a PDF using pdf.js (loaded on demand).
 * @param {File | ArrayBuffer} file
 * @param {number} [maxPages]
 * @returns {Promise<string>}
 */
export async function extractPdfText(file, maxPages = 5) {
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const pdfjs = await import('pdfjs-dist')
  try {
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    }
  } catch {
    // Worker configuration is optional; pdf.js can run on the main thread.
  }
  const document = await pdfjs.getDocument({ data }).promise
  const pageCount = Math.min(document.numPages, maxPages)
  const chunks = []
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    chunks.push(content.items.map((item) => item.str).join(' '))
  }
  return chunks.join('\n')
}

/**
 * Try to recover a DOI from a PDF file, then resolve its metadata.
 * @param {File} file
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 */
export async function extractDoiFromPdf(file, options = {}) {
  let text = ''
  try {
    text = await extractPdfText(file, 3)
  } catch (error) {
    text = ''
  }
  let doi = parseDoiFromText(text)
  if (!doi) doi = parseDoiFromText(file.name)
  if (!doi) throw new Error('No DOI was found in this PDF. Enter the DOI manually.')
  const reference = await fetchDoiMetadata(doi, options)
  return { doi, reference, textLength: text.length }
}

/**
 * Search Crossref by title and return a normalised reference for the best match.
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 */
export async function lookupByTitle(query, options = {}) {
  const trimmed = String(query || '').trim()
  if (trimmed.length < 3) throw new Error('Enter at least three characters of the title.')
  const response = await fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(trimmed)}&rows=1&select=DOI,title,author,container-title,issued,type,URL,abstract,volume,issue,page,publisher`, { signal: options.signal })
  if (!response.ok) throw new Error(`Crossref lookup failed (${response.status}).`)
  const payload = await response.json()
  const item = payload?.message?.items?.[0]
  if (!item) throw new Error('No matching title was found.')
  return normalizeReference(crossrefMessageToData(item))
}

// ---------------------------------------------------------------------------
// Open-access reference discovery
// ---------------------------------------------------------------------------

export const OA_SOURCES = [
  { id: 'openalex', label: 'OpenAlex', note: 'Broad open-access scholarly index' },
  { id: 'crossref', label: 'Crossref', note: 'Journal DOI metadata; OA links depend on Unpaywall' },
  { id: 'doaj', label: 'DOAJ', note: 'Directory of open-access journals' },
  { id: 'europepmc', label: 'Europe PMC / PubMed Central', note: 'Biomedical and life-science OA papers' },
  { id: 'arxiv', label: 'arXiv', note: 'Open preprints in physics, maths, CS and related fields' },
  { id: 'peerreviewed', label: 'Peer-reviewed journals (multi-source)', note: 'OpenAlex + DOAJ + Europe PMC + Crossref' }
]

export const PEER_REVIEWED_SOURCE_IDS = ['openalex', 'doaj', 'europepmc', 'crossref']

export const PATENT_SEARCH_LINKS = [
  { label: 'Google Patents', url: (query) => `https://patents.google.com/?q=${encodeURIComponent(query)}` },
  { label: 'Espacenet', url: (query) => `https://worldwide.espacenet.com/searchResults?query=${encodeURIComponent(query)}` },
  { label: 'USPTO Patent Public Search', url: (query) => `https://ppubs.uspto.gov/dirsearch-public/searches/searchWithBeFamilyWithQuery?query=${encodeURIComponent(query)}` },
  { label: 'PatentsView', url: () => 'https://search.patentsview.org/' },
  { label: 'Lens.org patents', url: (query) => `https://www.lens.org/lens/search/patent/list?q=${encodeURIComponent(query)}` }
]

export const PATTERN_SEARCH_LINKS = [
  { label: 'OpenAlex — patterns', url: (query) => `https://openalex.org/works?search=${encodeURIComponent(`${query} pattern`)}` },
  { label: 'Google Scholar — patterns', url: (query) => `https://scholar.google.com/scholar?q=${encodeURIComponent(`${query} pattern`)}` },
  { label: 'Crossref — patterns', url: (query) => `https://search.crossref.org/?q=${encodeURIComponent(`${query} pattern`)}` },
  { label: 'arXiv — patterns', url: (query) => `https://arxiv.org/search/?query=${encodeURIComponent(`${query} pattern`)}&searchtype=all` }
]

const PROXY_BASES = {
  crossref: '/api/crossref',
  unpaywall: '/api/unpaywall',
  europepmc: '/api/europepmc',
  arxiv: '/api/arxiv'
}

/**
 * Normalise a discovery record. Unknown source fields never break the search.
 * @param {any} [input]
 * @returns {any}
 */
export function normalizeSearchResult(input = {}) {
  const authors = Array.isArray(input.authors)
    ? input.authors.map((author) => stripJats(author)).filter(Boolean)
    : String(input.authors || '').split(/,\s*/).map((author) => stripJats(author)).filter(Boolean)
  const source = String(input.source || 'unknown')
  const doi = normalizeDoi(input.doi || '')
  const url = String(input.url || (doi ? `https://doi.org/${doi}` : '')).trim()
  const oaUrl = String(input.oaUrl || '').trim()
  return {
    key: String(input.key || `${source}:${doi || url || stripJats(input.title || '')}`),
    title: stripJats(input.title || 'Untitled record'),
    authors,
    year: String(input.year || '').trim(),
    journal: stripJats(input.journal || ''),
    doi,
    url,
    oaUrl,
    type: String(input.type || 'article'),
    abstract: stripJats(input.abstract || ''),
    source,
    isOa: Boolean(input.isOa || oaUrl),
    isReview: Boolean(input.isReview),
    isPeerReviewed: Boolean(input.isPeerReviewed),
    publisher: stripJats(input.publisher || ''),
    volume: String(input.volume || ''),
    issue: String(input.issue || ''),
    pages: String(input.pages || ''),
    note: stripJats(input.note || '')
  }
}

function proxyUrl(directUrl, proxyBase) {
  if (!proxyBase) return directUrl
  return `${proxyBase}${String(directUrl).replace(/^https?:\/\/[^/]+/, '')}`
}

async function fetchJsonWithProxy(directUrl, proxyBase, options = {}) {
  const headers = { Accept: options.accept || 'application/json' }
  const errors = []
  const attempts = [directUrl]
  if (proxyBase) attempts.push(proxyUrl(directUrl, proxyBase))
  for (const url of attempts) {
    if (options.signal?.aborted) break
    try {
      const response = await fetch(url, { signal: options.signal, headers })
      if (!response.ok) {
        const base = typeof window === 'undefined' ? 'http://localhost' : window.location.href
        errors.push(`${new URL(url, base).hostname} returned ${response.status}`)
        continue
      }
      return options.raw ? await response.text() : await response.json()
    } catch (error) {
      if (options.signal?.aborted) throw error
      errors.push(error instanceof Error ? error.message : 'Request failed')
    }
  }
  throw new Error(errors.join('; ') || 'The provider could not be reached.')
}

function openAlexWorkToResult(work) {
  const best = work?.best_oa_location || work?.primary_location || {}
  return normalizeSearchResult({
    key: work?.id || work?.doi || work?.title,
    title: work?.title || work?.display_name || '',
    authors: (work?.authorships || []).map((entry) => entry?.author?.display_name).filter(Boolean),
    year: work?.publication_year || '',
    journal: best?.source?.display_name || work?.primary_location?.source?.display_name || '',
    doi: work?.doi || '',
    url: work?.doi ? `https://doi.org/${normalizeDoi(work.doi)}` : work?.id || best?.landing_page_url || '',
    oaUrl: best?.landing_page_url || best?.pdf_url || '',
    type: work?.type || 'article',
    abstract: work?.abstract_inverted_index ? invertAbstract(work.abstract_inverted_index) : '',
    source: 'OpenAlex',
    isOa: Boolean(work?.open_access?.is_oa),
    isReview: String(work?.type || '').toLowerCase() === 'review',
    isPeerReviewed: Boolean(best?.source?.is_peer_reviewed),
    publisher: best?.source?.host_organization_name || ''
  })
}

function invertAbstract(index) {
  if (!index || typeof index !== 'object') return ''
  const words = []
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions || []) words[position] = word
  }
  return words.filter(Boolean).join(' ')
}

function doajArticleToResult(article) {
  const bibjson = article?.bibjson || {}
  const identifiers = Array.isArray(bibjson.identifier) ? bibjson.identifier : []
  const doi = identifiers.find((entry) => String(entry?.type || '').toLowerCase() === 'doi')?.id || ''
  const links = Array.isArray(bibjson.link) ? bibjson.link : []
  const url = links.find((entry) => entry?.type === 'fulltext')?.url || links[0]?.url || ''
  return normalizeSearchResult({
    key: doi || bibjson.id || bibjson.title,
    title: bibjson.title || '',
    authors: (bibjson.author || []).map((author) => author?.name).filter(Boolean),
    year: bibjson.year || '',
    journal: bibjson.journal?.title || '',
    doi,
    url,
    oaUrl: url,
    type: (bibjson.type || 'article').toLowerCase() === 'review' ? 'review' : 'article',
    abstract: bibjson.abstract || '',
    source: 'DOAJ',
    isOa: true,
    isReview: String(bibjson.type || '').toLowerCase().includes('review'),
    isPeerReviewed: true,
    publisher: bibjson.journal?.publisher || '',
    volume: bibjson.journal?.volume || '',
    issue: bibjson.journal?.issue || '',
    pages: bibjson.pages || ''
  })
}

function europePmcToResult(item) {
  const doi = normalizeDoi(item?.doi || '')
  const pmcid = String(item?.pmcid || '')
  const oaUrl = pmcid ? `https://europepmc.org/articles/${encodeURIComponent(pmcid)}` : ''
  const pubTypes = String(item?.pubTypeList?.pubType || item?.pubType || '').toLowerCase()
  return normalizeSearchResult({
    key: doi || item?.id || item?.title,
    title: item?.title || '',
    authors: String(item?.authorString || '').split(/,\s*/).map((name) => name.trim()).filter(Boolean),
    year: item?.pubYear || '',
    journal: item?.journalInfo?.journal?.title || item?.journalTitle || '',
    doi,
    url: doi ? `https://doi.org/${doi}` : oaUrl || `https://europepmc.org/article/${item?.source || 'MED'}/${item?.id || ''}`,
    oaUrl,
    type: pubTypes.includes('review') ? 'review' : 'article',
    abstract: item?.abstractText || '',
    source: 'Europe PMC',
    isOa: String(item?.isOpenAccess || '').toUpperCase() === 'Y' || Boolean(oaUrl),
    isReview: pubTypes.includes('review'),
    isPeerReviewed: true
  })
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function arxivEntryToResult(entry) {
  const raw = String(entry || '')
  const read = (tag) => decodeXml((raw.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [])[1])
  const id = read('id')
  const doi = normalizeDoi(read('doi'))
  const pdfLink = (raw.match(/<link[^>]+title="pdf"[^>]+href="([^"]+)"/i) || [])[1] || ''
  const published = read('published')
  return normalizeSearchResult({
    key: id || doi || read('title'),
    title: read('title'),
    authors: [...raw.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/gi)].map((match) => decodeXml(match[1])).filter(Boolean),
    year: (published.match(/\d{4}/) || [])[0] || '',
    journal: 'arXiv preprint',
    doi,
    url: id || pdfLink,
    oaUrl: pdfLink || id,
    type: 'preprint',
    abstract: read('summary'),
    source: 'arXiv',
    isOa: true,
    isReview: false,
    isPeerReviewed: false,
    note: 'Preprint; peer-review status must be checked at the published venue.'
  })
}

/**
 * Search one open-access provider.
 * @param {string} sourceId
 * @param {string} query
 * @param {{rows?: number, email?: string, signal?: AbortSignal}} [options]
 * @returns {Promise<any[]>}
 */
export async function searchSource(sourceId, query, options = {}) {
  const trimmed = String(query || '').trim()
  if (!trimmed) throw new Error('Enter a search term.')
  const rows = Math.max(1, Math.min(30, Number(options.rows) || 10))
  const email = String(options.email || '').trim()
  const mailto = email ? `&mailto=${encodeURIComponent(email)}` : ''

  switch (sourceId) {
    case 'openalex': {
      const filter = '&filter=is_oa:true'
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(trimmed)}&per-page=${rows}${filter}${mailto.replace('&mailto=', '&mailto=')}`
      const payload = await fetchJsonWithProxy(url, null, { signal: options.signal })
      return (payload?.results || []).map(openAlexWorkToResult)
    }
    case 'crossref': {
      const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(trimmed)}&rows=${rows}${mailto}`
      const payload = await fetchJsonWithProxy(url, PROXY_BASES.crossref, { signal: options.signal })
      return (payload?.message?.items || []).map((item) => {
        const data = crossrefMessageToData(item)
        return normalizeSearchResult({
          key: data.doi || data.url || data.title,
          title: data.title,
          authors: data.authors,
          year: data.year,
          journal: data.journal,
          doi: data.doi,
          url: data.url,
          type: data.type,
          abstract: data.abstract,
          source: 'Crossref',
          publisher: data.publisher,
          note: 'OA link requires a valid Unpaywall email.'
        })
      })
    }
    case 'doaj': {
      const url = `https://doaj.org/api/search/articles/${encodeURIComponent(trimmed)}?pageSize=${rows}`
      const payload = await fetchJsonWithProxy(url, null, { signal: options.signal })
      return (payload?.results || []).map(doajArticleToResult)
    }
    case 'europepmc': {
      const queryText = `(${trimmed}) AND OPEN_ACCESS:Y`
      const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(queryText)}&format=json&pageSize=${rows}&resultType=core`
      const payload = await fetchJsonWithProxy(url, PROXY_BASES.europepmc, { signal: options.signal })
      return (payload?.resultList?.result || []).map(europePmcToResult)
    }
    case 'arxiv': {
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(trimmed)}&start=0&max_results=${rows}`
      const xml = await fetchJsonWithProxy(url, PROXY_BASES.arxiv, { signal: options.signal, raw: true, accept: 'application/atom+xml' })
      return [...String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => arxivEntryToResult(match[1]))
    }
    default:
      throw new Error(`Unknown source: ${sourceId}`)
  }
}

/** Remove repeated DOI/title records so one search does not fill the library with duplicates. */
export function dedupeSearchResults(results) {
  const seen = new Set()
  const output = []
  for (const item of results || []) {
    const doi = normalizeDoi(item.doi).toLowerCase()
    const title = stripJats(item.title).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 90)
    const keys = [doi && `doi:${doi}`, title && `title:${title}`].filter(Boolean)
    if (keys.some((key) => seen.has(key))) continue
    keys.forEach((key) => seen.add(key))
    output.push(item)
  }
  return output
}

/**
 * Resolve Unpaywall OA links for DOI-bearing results. Requires the user's own email.
 * @param {any[]} results
 * @param {string} email
 * @param {{signal?: AbortSignal, limit?: number}} [options]
 * @returns {Promise<{results: any[], errors: string[]}>}
 */
export async function enrichWithUnpaywall(results, email, options = {}) {
  const cleanEmail = String(email || '').trim()
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { results, errors: ['A valid email is required for Unpaywall. Results were kept without OA enrichment.'] }
  }
  const targets = (results || []).filter((item) => item.doi && !item.oaUrl).slice(0, Math.max(1, Number(options.limit) || 8))
  const errors = []
  const updated = new Map()
  await Promise.allSettled(targets.map(async (item) => {
    try {
      const url = `https://api.unpaywall.org/v2/${encodeURIComponent(normalizeDoi(item.doi))}?email=${encodeURIComponent(cleanEmail)}`
      const payload = await fetchJsonWithProxy(url, PROXY_BASES.unpaywall, { signal: options.signal })
      const best = payload?.best_oa_location || (payload?.oa_locations || []).find((location) => location?.url_for_pdf || location?.url_for_landing_page)
      const oaUrl = best?.url_for_landing_page || best?.url_for_pdf || ''
      updated.set(item.key, {
        ...item,
        oaUrl: oaUrl || item.oaUrl,
        isOa: Boolean(payload?.is_oa) || Boolean(oaUrl) || item.isOa,
        note: oaUrl ? `${item.note ? `${item.note} ` : ''}OA link resolved by Unpaywall.`.trim() : item.note
      })
    } catch (error) {
      errors.push(`Unpaywall could not resolve ${item.doi}: ${error instanceof Error ? error.message : 'request failed'}`)
    }
  }))
  return { results: (results || []).map((item) => updated.get(item.key) || item), errors }
}

/**
 * Search multiple sources. A failed source is reported without discarding the others.
 * @param {string} query
 * @param {string[]} sourceIds
 * @param {{rows?: number, email?: string, signal?: AbortSignal, enrichOa?: boolean}} [options]
 * @returns {Promise<{results: any[], errors: string[], sources: string[]}>}
 */
export async function searchOpenAccess(query, sourceIds, options = {}) {
  const selected = Array.isArray(sourceIds) ? sourceIds : []
  const ids = selected.includes('peerreviewed') ? [...new Set([...selected.filter((id) => id !== 'peerreviewed'), ...PEER_REVIEWED_SOURCE_IDS])] : [...new Set(selected)]
  if (!ids.length) throw new Error('Choose at least one metadata source.')
  const settled = await Promise.allSettled(ids.map((id) => searchSource(id, query, options)))
  const results = []
  const errors = []
  const sources = []
  settled.forEach((entry, index) => {
    if (entry.status === 'fulfilled') {
      results.push(...entry.value)
      if (entry.value.length) sources.push(ids[index])
    } else {
      errors.push(`${ids[index]}: ${entry.reason instanceof Error ? entry.reason.message : 'search failed'}`)
    }
  })
  let output = dedupeSearchResults(results)
  if (options.enrichOa !== false && options.email) {
    const enriched = await enrichWithUnpaywall(output, options.email, { signal: options.signal })
    output = enriched.results
    errors.push(...enriched.errors)
  }
  return { results: output, errors, sources }
}

/** Build external IP/patent and pattern search URLs. No fake API results are generated. */
export function ipPatternLinks(query) {
  const text = String(query || '').trim()
  return {
    patents: PATENT_SEARCH_LINKS.map((link) => ({ ...link, href: link.url(text) })),
    patterns: PATTERN_SEARCH_LINKS.map((link) => ({ ...link, href: link.url(text) }))
  }
}
