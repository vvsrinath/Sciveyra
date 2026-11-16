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
