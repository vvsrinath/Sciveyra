import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_OLLAMA_ENDPOINT, DEFAULT_OLLAMA_MODEL, REWRITE_PRESETS,
  analyzeParagraph, buildOllamaPrompt, normalizeEndpoint, rewriteParagraph,
  rewriteWithOllama, summarizeChanges
} from '../src/lib/rewriter.js'

const WORDY = 'It is important to note that the samples were analysed by the team in order to improve the result. The result is very good.'

describe('local paragraph rewriting', () => {
  it('exposes the documented style presets', () => {
    expect(REWRITE_PRESETS.map((preset) => preset.id)).toEqual(['natural', 'academic', 'concise'])
    for (const preset of REWRITE_PRESETS) expect(preset.prompt.length).toBeGreaterThan(10)
  })

  it('removes fillers and improves wordy prose', () => {
    const rewritten = rewriteParagraph(WORDY, { preset: 'concise' })
    expect(rewritten).not.toMatch(/it is important to note that|in order to/i)
    expect(rewritten).toContain('The team analysed the samples')
    expect(rewritten).not.toBe(WORDY)
  })

  it('uses a lighter touch for the academic preset', () => {
    const academic = rewriteParagraph(WORDY, { preset: 'academic' })
    const concise = rewriteParagraph(WORDY, { preset: 'concise' })
    expect(academic).not.toContain('due to the fact that')
    expect(academic).not.toMatch(/in order to/i)
    expect(concise.length).toBeLessThanOrEqual(academic.length)
  })

  it('protects scientific values, DOIs, URLs and citations', () => {
    const input = 'The value was 42.5 °C (Smith, 2020) and the DOI is 10.1234/abc. See https://example.org/paper for details.'
    for (const preset of ['natural', 'academic', 'concise']) {
      const rewritten = rewriteParagraph(input, { preset })
      expect(rewritten).toContain('42.5 °C')
      expect(rewritten).toContain('10.1234/abc')
      expect(rewritten).toContain('https://example.org/paper')
      expect(rewritten).toContain('(Smith, 2020)')
    }
  })

  it('preserves paragraph breaks and handles empty input', () => {
    const rewritten = rewriteParagraph(`${WORDY}\n\n${WORDY}`)
    expect(rewritten).toContain('\n\n')
    expect(rewriteParagraph('   ')).toBe('')
  })

  it('analyses and summarises changes without claiming a quality score', () => {
    const analysis = analyzeParagraph(WORDY)
    expect(analysis.wordCount).toBeGreaterThan(5)
    expect(analysis.fillerCount).toBeGreaterThan(0)
    expect(analysis.readability).toBeTruthy()
    const summary = summarizeChanges(WORDY, rewriteParagraph(WORDY, { preset: 'concise' }))
    expect(summary.fillersRemoved).toBeGreaterThan(0)
    expect(summary.wordDelta).toBeLessThan(0)
    expect(summary.afterWords).toBeGreaterThan(0)
  })
})

describe('optional self-hosted Ollama helper', () => {
  it('normalises endpoint URLs and preserves defaults', () => {
    expect(normalizeEndpoint('')).toBe(DEFAULT_OLLAMA_ENDPOINT)
    expect(normalizeEndpoint('localhost:11434/api/generate')).toBe('http://localhost:11434')
    expect(normalizeEndpoint('https://ollama.research.local/api/chat/')).toBe('https://ollama.research.local')
    expect(() => normalizeEndpoint('ftp://localhost')).toThrow(/http/)
  })

  it('builds a prompt that forbids invented facts and protects values', () => {
    const prompt = buildOllamaPrompt(WORDY, 'academic')
    expect(prompt).toContain(WORDY)
    expect(prompt).toContain('Preserve all numbers')
    expect(prompt).toContain('Do not invent facts')
    expect(prompt).toContain('Return only the rewritten paragraph')
  })

  it('sends text only to the supplied endpoint', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ response: 'A rewritten paragraph.' })
    }))
    const output = await rewriteWithOllama(WORDY, {
      endpoint: 'http://localhost:11434', model: 'llama3.2', preset: 'concise'
    }, fetchMock)
    expect(output).toBe('A rewritten paragraph.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/generate')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.model).toBe('llama3.2')
    expect(body.stream).toBe(false)
    expect(body.prompt).toContain(WORDY)
  })

  it('surfaces provider and validation errors', async () => {
    await expect(rewriteWithOllama('Text to rewrite', { endpoint: 'bad endpoint::' }, vi.fn())).rejects.toThrow()
    const failingFetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    await expect(rewriteWithOllama('Text to rewrite', {}, failingFetch)).rejects.toThrow(/503/)
    const emptyFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ response: '' }) }))
    await expect(rewriteWithOllama('Text to rewrite', {}, emptyFetch)).rejects.toThrow(/empty rewrite/)
    await expect(rewriteWithOllama('   ', {}, vi.fn())).rejects.toThrow('Enter a paragraph')
    expect(DEFAULT_OLLAMA_MODEL).toBeTruthy()
  })
})
