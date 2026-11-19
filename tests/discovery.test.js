import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OA_SOURCES, PEER_REVIEWED_SOURCE_IDS, dedupeSearchResults, enrichWithUnpaywall,
  ipPatternLinks, normalizeSearchResult, searchOpenAccess, searchSource
} from '../src/lib/metadata.js'

function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload, text: async () => JSON.stringify(payload) }
}

function textResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body), text: async () => body }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('search result normalisation', () => {
  it('cleans provider payloads and derives safe URLs', () => {
    const result = normalizeSearchResult({
      title: '<i>Metal</i> &amp; alloy',
      authors: ['Curie, Marie', ''],
      doi: 'https://doi.org/10.1234/abc.',
      year: 2022,
      source: 'OpenAlex',
      journal: '<b>Journal</b>',
      isOa: true,
      isReview: true,
      isPeerReviewed: true
    })
    expect(result.title).toBe('Metal & alloy')
    expect(result.authors).toEqual(['Curie, Marie'])
    expect(result.doi).toBe('10.1234/abc')
    expect(result.url).toBe('https://doi.org/10.1234/abc')
    expect(result.journal).toBe('Journal')
    expect(result.isOa).toBe(true)
    expect(result.isReview).toBe(true)
    expect(result.isPeerReviewed).toBe(true)
  })

  it('deduplicates by DOI and by normalised title', () => {
    const first = normalizeSearchResult({ title: 'A Study of Catalysts', doi: '10.1/a', source: 'OpenAlex' })
    const doiDuplicate = normalizeSearchResult({ title: 'Different title', doi: 'https://doi.org/10.1/a', source: 'DOAJ' })
    const titleDuplicate = normalizeSearchResult({ title: 'A study of catalysts!', doi: '', source: 'arXiv' })
    const distinct = normalizeSearchResult({ title: 'Another Paper', doi: '10.1/b', source: 'Crossref' })
    expect(dedupeSearchResults([first, doiDuplicate, titleDuplicate, distinct])).toHaveLength(2)
  })

  it('exposes peer-reviewed bundles and external IP/pattern links', () => {
    expect(PEER_REVIEWED_SOURCE_IDS).toEqual(expect.arrayContaining(['openalex', 'doaj', 'europepmc', 'crossref']))
    expect(OA_SOURCES.map((source) => source.id)).toContain('peerreviewed')
    const links = ipPatternLinks('nickel catalyst')
    expect(links.patents.length).toBeGreaterThan(2)
    expect(links.patterns.length).toBeGreaterThan(2)
    expect(links.patents[0].href).toContain(encodeURIComponent('nickel catalyst'))
    expect(links.patterns[0].href).toContain(encodeURIComponent('nickel catalyst pattern'))
  })
})

describe('provider search adapters', () => {
  it('requests OA-filtered OpenAlex works and maps results', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      results: [{
        id: 'https://openalex.org/W1',
        title: 'Open access study',
        doi: 'https://doi.org/10.1234/oa',
        publication_year: 2023,
        authorships: [{ author: { display_name: 'A. Scientist' } }],
        open_access: { is_oa: true },
        best_oa_location: { source: { display_name: 'Journal of Tests', is_peer_reviewed: true }, landing_page_url: 'https://example.org/paper' },
        type: 'article'
      }]
    }))
    vi.stubGlobal('fetch', fetchMock)
    const results = await searchSource('openalex', 'catalyst', { rows: 5 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('search=catalyst')
    expect(url).toContain('per-page=5')
    expect(url).toContain('filter=is_oa:true')
    expect(results).toHaveLength(1)
    expect(results[0].source).toBe('OpenAlex')
    expect(results[0].journal).toBe('Journal of Tests')
    expect(results[0].isPeerReviewed).toBe(true)
    expect(results[0].oaUrl).toBe('https://example.org/paper')
  })

  it('uses the same-origin proxy when a provider blocks the browser', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).startsWith('/api/arxiv')) {
        return textResponse(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
          <entry><id>http://arxiv.org/abs/2401.00001</id><title>Quantum patterns</title>
          <author><name>J. Doe</name></author><published>2024-01-01T00:00:00Z</published>
          <summary>&lt;i&gt;Abstract&lt;/i&gt;</summary>
          <link title="pdf" href="https://arxiv.org/pdf/2401.00001" /></entry></feed>`)
      }
      return textResponse('blocked', 403)
    })
    vi.stubGlobal('fetch', fetchMock)
    const results = await searchSource('arxiv', 'quantum', { rows: 3 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/arxiv')
    expect(results).toHaveLength(1)
    expect(results[0].source).toBe('arXiv')
    expect(results[0].type).toBe('preprint')
    expect(results[0].isOa).toBe(true)
    expect(results[0].isPeerReviewed).toBe(false)
    expect(results[0].abstract).toBe('Abstract')
  })

  it('reports provider errors without inventing results', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => textResponse('unavailable', 503)))
    await expect(searchSource('crossref', 'anything')).rejects.toThrow(/503/)
  })

  it('rejects empty queries and unknown sources', async () => {
    await expect(searchSource('openalex', '   ')).rejects.toThrow('Enter a search term.')
    await expect(searchSource('unknown', 'query')).rejects.toThrow('Unknown source')
  })
})

describe('multi-source discovery and Unpaywall', () => {
  it('merges sources, deduplicates and records partial failures', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('api.openalex.org')) {
        return jsonResponse({ results: [{ title: 'Shared paper', doi: '10.1/shared', source: 'OpenAlex', publication_year: 2020 }] })
      }
      if (String(url).includes('doaj.org')) {
        return jsonResponse({ results: [{ bibjson: { title: 'Shared paper', identifier: [{ type: 'doi', id: '10.1/shared' }] } }] })
      }
      return textResponse('failed', 500)
    })
    vi.stubGlobal('fetch', fetchMock)
    const output = await searchOpenAccess('shared paper', ['openalex', 'doaj', 'europepmc'], { rows: 5, enrichOa: false })
    expect(output.results).toHaveLength(1)
    expect(output.sources).toEqual(expect.arrayContaining(['openalex', 'doaj']))
    expect(output.errors.some((error) => error.includes('europepmc'))).toBe(true)
  })

  it('expands the peer-reviewed bundle to its component sources', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('api.openalex.org')) return jsonResponse({ results: [] })
      return textResponse('blocked', 403)
    })
    vi.stubGlobal('fetch', fetchMock)
    const output = await searchOpenAccess('anything', ['peerreviewed'], { rows: 2, enrichOa: false })
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4)
    expect(output.results).toEqual([])
    expect(output.errors).toHaveLength(3)
  })

  it('enriches DOI results with a valid user email', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      is_oa: true,
      best_oa_location: { url_for_landing_page: 'https://example.org/free' }
    }))
    vi.stubGlobal('fetch', fetchMock)
    const result = normalizeSearchResult({ title: 'Paywalled record', doi: '10.1/paywall', source: 'Crossref' })
    const output = await enrichWithUnpaywall([result], 'researcher@example.org')
    expect(output.errors).toEqual([])
    expect(output.results[0].oaUrl).toBe('https://example.org/free')
    expect(output.results[0].isOa).toBe(true)
    expect(String(fetchMock.mock.calls[0][0])).toContain('email=researcher%40example.org')
  })

  it('keeps results untouched without a valid user email', async () => {
    const result = normalizeSearchResult({ title: 'Paywalled record', doi: '10.1/paywall', source: 'Crossref' })
    const output = await enrichWithUnpaywall([result], 'not-an-email')
    expect(output.results).toEqual([result])
    expect(output.errors[0]).toContain('valid email')
  })
})
