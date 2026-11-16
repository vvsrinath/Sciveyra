import { describe, expect, it } from 'vitest'
import { analyzeDraft, readabilityLabel } from '../src/lib/writing.js'

describe('analyzeDraft', () => {
  const sample = `This is a very simple draft. It was measured carefully and the result was recorded in the notebook.

The sample was measured using the standard protocol (Smith, 2020). It is important to note that the sample was measured again. This additional sentence exists to make the draft slightly longer and more representative of normal scientific writing, so that the analysis can demonstrate how long sentences are detected by the local writing checks.`

  it('counts words, sentences, paragraphs and citations', () => {
    const result = analyzeDraft(sample)
    expect(result.wordCount).toBeGreaterThan(40)
    expect(result.sentenceCount).toBe(5)
    expect(result.paragraphCount).toBe(2)
    expect(result.citationCount).toBe(1)
    expect(result.characters).toBe(sample.length)
    expect(result.readingMinutes).toBeGreaterThan(0)
  })

  it('flags repeated words, fillers, passive voice and long sentences', () => {
    const result = analyzeDraft(sample)
    expect(result.repeated.some(([word]) => word === 'measured')).toBe(true)
    expect(result.fillers.some((entry) => entry.phrase === 'very')).toBe(true)
    expect(result.fillers.some((entry) => entry.phrase === 'it is important to note that')).toBe(true)
    expect(result.passiveCount).toBeGreaterThanOrEqual(3)
    expect(result.longSentences.length).toBeGreaterThan(0)
  })

  it('handles empty text without dividing by zero', () => {
    const result = analyzeDraft('')
    expect(result.wordCount).toBe(0)
    expect(result.sentenceCount).toBe(0)
    expect(result.flesch).toBeNull()
    expect(result.readingMinutes).toBe(0)
    expect(result.longSentences).toEqual([])
  })

  it('counts markdown headings and first-person pronouns', () => {
    const result = analyzeDraft('# Methods\nWe measured the samples.')
    expect(result.headingCount).toBe(1)
    expect(result.firstPersonCount).toBe(1)
  })
})

describe('readabilityLabel', () => {
  it('maps Flesch scores to labels', () => {
    expect(readabilityLabel(85)).toBe('Very easy')
    expect(readabilityLabel(65)).toBe('Plain English')
    expect(readabilityLabel(45)).toBe('Difficult')
    expect(readabilityLabel(20)).toBe('Very difficult')
    expect(readabilityLabel(null)).toBe('Not enough text')
  })
})
