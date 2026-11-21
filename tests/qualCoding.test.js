import { describe, expect, it } from 'vitest'
import {
  buildCodebook,
  codebookCsv,
  countOccurrences,
  firstMatchContext,
  normalizeCodes
} from '../src/lib/qualCoding.js'

describe('qualitative coding helpers', () => {
  it('normalises comma, semicolon and newline separated codes without duplicates', () => {
    expect(normalizeCodes('  trust, transparency;\nequity\nTRUST, ')).toEqual(['trust', 'transparency', 'equity'])
    expect(normalizeCodes(['', 'care', ' care '])).toEqual(['care'])
  })

  it('counts literal, case-insensitive matches and treats regex characters as text', () => {
    const text = 'Trust improved. TRUST improved again. We discussed trust, but not trustworthiness.'
    expect(countOccurrences(text, 'trust')).toBe(4) // includes the substring in "trustworthiness"
    expect(countOccurrences(text, '')).toBe(0)
    expect(countOccurrences('C++ is used. C++ helps.', 'C++')).toBe(2)
    expect(countOccurrences('a.b axb', 'a.b')).toBe(1)
  })

  it('returns a short context snippet around the first match', () => {
    expect(firstMatchContext('Participants valued clear consent before the interview.', 'consent', 8))
      .toContain('consent')
    expect(firstMatchContext('nothing here', 'missing')).toBe('')
  })

  it('builds a codebook and exports safely escaped CSV', () => {
    const rows = buildCodebook('Trust matters. Trust is earned. Barriers remain.', 'trust, barriers, unused')
    expect(rows.map((row) => row.count)).toEqual([2, 1, 0])
    expect(rows[0].context).toContain('Trust')
    const csv = codebookCsv(rows)
    expect(csv.split('\n')[0]).toBe('code,count,first_match_context')
    expect(codebookCsv([{ code: 'a,b', count: 1, context: 'say "a,b"' }])).toContain('"a,b",1,"say ""a,b"""')
  })
})
