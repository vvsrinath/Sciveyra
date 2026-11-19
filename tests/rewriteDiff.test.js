import { describe, expect, it } from 'vitest'
import { applyRewriteDecisions, buildRewriteDiff, summarizeRewriteDiff } from '../src/lib/rewriteDiff.js'
import { verifyProtectedTokens } from '../src/lib/rewriter.js'

describe('inline rewrite diff', () => {
  const before = 'It is important to note that the samples were analysed by the team in order to improve the reaction rate.'
  const after = 'The team analysed the samples to improve the reaction rate.'

  it('builds reviewable groups and applies all or no decisions', () => {
    const diff = buildRewriteDiff(before, after)
    expect(diff.groups.length).toBeGreaterThan(0)
    expect(applyRewriteDecisions(diff, {})).toBe(after)
    const rejectAll = Object.fromEntries(diff.groups.map((group) => [group.id, false]))
    expect(applyRewriteDecisions(diff, rejectAll)).toBe(before)
    expect(summarizeRewriteDiff(diff, rejectAll).rejected).toBe(diff.groups.length)
  })

  it('accepts one change while rejecting another', () => {
    const diff = buildRewriteDiff('Alpha beta gamma.', 'Alpha delta epsilon.')
    expect(diff.groups.length).toBe(2)
    const decisions = { change_1: false }
    expect(applyRewriteDecisions(diff, decisions)).toBe('Alpha beta epsilon.')
  })

  it('handles empty and identical selections', () => {
    expect(buildRewriteDiff('', '').groups).toHaveLength(0)
    expect(applyRewriteDecisions(buildRewriteDiff('Same text', 'Same text'), {})).toBe('Same text')
  })
})

describe('protected value verification', () => {
  it('accepts preserved values and rejects changed or invented values', () => {
    const original = 'The dose was 5 mg [3] (2024).'
    expect(verifyProtectedTokens(original, 'A dose of 5 mg [3] (2024) was used.').valid).toBe(true)
    expect(verifyProtectedTokens(original, 'The dose was 50 mg [3] (2024).').missing).toContain('5 mg')
    expect(verifyProtectedTokens(original, 'The dose was 5 mg [3] (2024) and 7 mg.').unexpected).toContain('7 mg')
  })
})
