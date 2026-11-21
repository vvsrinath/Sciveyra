import { csvEscape } from './util.js'

/** Small, literal, local-only coding helper for qualitative text. */
export function normalizeCodes(input) {
  const parts = Array.isArray(input) ? input : String(input ?? '').split(/[\n,;]+/)
  const seen = new Set()
  const codes = []
  for (const part of parts) {
    const code = String(part ?? '').trim()
    if (!code) continue
    const key = code.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    codes.push(code)
  }
  return codes
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function countOccurrences(text, code) {
  const haystack = String(text ?? '')
  const needle = String(code ?? '').trim()
  if (!needle) return 0
  const pattern = new RegExp(escapeRegExp(needle), 'gi')
  let count = 0
  let match
  while ((match = pattern.exec(haystack)) !== null) {
    count += 1
    if (match[0].length === 0) pattern.lastIndex += 1
  }
  return count
}

export function firstMatchContext(text, code, radius = 34) {
  const haystack = String(text ?? '')
  const needle = String(code ?? '').trim()
  if (!needle) return ''
  const index = haystack.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase())
  if (index < 0) return ''
  const start = Math.max(0, index - radius)
  const end = Math.min(haystack.length, index + needle.length + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < haystack.length ? '…' : ''
  return `${prefix}${haystack.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`
}

export function buildCodebook(text, codes) {
  return normalizeCodes(codes).map((code) => ({
    code,
    count: countOccurrences(text, code),
    context: firstMatchContext(text, code)
  }))
}

export function codebookCsv(rows) {
  const header = 'code,count,first_match_context'
  const lines = (Array.isArray(rows) ? rows : []).map((row) => [
    csvEscape(row.code),
    Number(row.count) || 0,
    csvEscape(row.context)
  ].join(','))
  return [header, ...lines].join('\n')
}
