/**
 * Deterministic figure/table numbering and cross-references for the Writing Lab.
 * Cross-reference tokens stay in stored Markdown (`@fig:id`, `@tbl:key`) and are
 * resolved only for the preview and exports. No network and no clock.
 */
export const FIGURE_PREFIX = 'Figure'
export const TABLE_PREFIX = 'Table'

const IMAGE_SOURCE = '!\\[([^\\]]*)\\]\\(([^)\\s]+)(?:\\s+"[^"]*")?\\)'
const CROSS_REF_SOURCE = '@(fig|tbl):([A-Za-z0-9_-]+)'

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function slug(value, fallback = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || fallback
}

/** Stable cross-reference token base for UI-generated tables. */
export function stableKey(value, fallback = 'item') {
  return slug(value, fallback)
}

function cleanCaption(value, fallback = '') {
  return String(value || '')
    .replace(/@(?:fig|tbl):[A-Za-z0-9_-]+/gi, '')
    .replace(/^\s*[.:-]\s*/, '')
    .replace(/[[\]\r\n]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim() || fallback
}

function codeRanges(markdown) {
  const ranges = []
  const push = (start, end) => {
    if (!ranges.some(([from, to]) => start < to && end > from)) ranges.push([start, end])
  }
  const fenced = /```[\s\S]*?```/g
  let match
  while ((match = fenced.exec(markdown))) push(match.index, match.index + match[0].length)
  const inline = /`[^`\n]*`/g
  while ((match = inline.exec(markdown))) push(match.index, match.index + match[0].length)
  return ranges.sort((a, b) => a[0] - b[0])
}

function transformOutsideCode(markdown, transform) {
  let output = ''
  let cursor = 0
  for (const [start, end] of codeRanges(markdown)) {
    output += transform(markdown.slice(cursor, start), cursor)
    output += markdown.slice(start, end)
    cursor = end
  }
  output += transform(markdown.slice(cursor), cursor)
  return output
}

/** Blank only code spans, preserving offsets and all normal Markdown. */
function maskCode(markdown) {
  let output = ''
  let cursor = 0
  for (const [start, end] of codeRanges(markdown)) {
    output += markdown.slice(cursor, start)
    output += markdown.slice(start, end).replace(/[^\n]/g, ' ')
    cursor = end
  }
  return output + markdown.slice(cursor)
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

/**
 * Find where a trailing caption search must stop: the next figure/table or
 * heading. Captions may follow a short line of prose, so they are not required
 * to be adjacent to the item they describe.
 */
function nextNumberableBoundary(source, end) {
  const tail = source.slice(end)
  const masked = maskCode(tail)
  const imageIndex = masked.search(new RegExp(IMAGE_SOURCE))
  let boundary = imageIndex === -1 ? masked.length : imageIndex

  const lines = masked.split('\n')
  let offset = 0
  for (const line of lines) {
    if (isTableSeparator(line) || /^\s{0,3}#{1,6}\s/.test(line)) {
      boundary = Math.min(boundary, offset)
      break
    }
    offset += line.length + 1
  }
  return end + boundary
}

function readCaption(source, end, expectedKind) {
  const boundary = Math.min(nextNumberableBoundary(source, end), end + 1200)
  const tail = source.slice(end, boundary)
  const isFigure = expectedKind === 'figure'
  const prefix = isFigure ? '(?:Figure|Fig\\.)' : '(?:Table|Tab\\.)'
  const tokenType = isFigure ? 'fig' : 'tbl'
  const fallback = isFigure ? 'Figure caption' : 'Table caption'

  const tokenMatch = tail.match(new RegExp(`(?:^|\\n)[ \\t]*\\*${prefix}\\s+\\[@${tokenType}:([A-Za-z0-9_-]+)\\]\\.?\\s*([^*\\n]*)\\*`, 'i'))
  if (tokenMatch) {
    return { hasCaption: true, key: tokenMatch[1], caption: cleanCaption(tokenMatch[2], fallback) }
  }

  const plainMatch = tail.match(new RegExp(`(?:^|\\n)[ \\t]*\\*${prefix}\\s+([^*\\n]+)\\*`, 'i'))
  if (!plainMatch) return { hasCaption: false, caption: '', key: '' }
  return { hasCaption: true, key: '', caption: cleanCaption(plainMatch[1], fallback) }
}

/**
 * Find figure images and GFM tables in document order.
 * @param {string} markdown
 * @param {any[]} assets
 * @returns {any[]}
 */
export function scanNumberables(markdown, assets = []) {
  const source = String(markdown || '')
  const masked = maskCode(source)
  const assetById = new Map((Array.isArray(assets) ? assets : []).map((asset) => [asset.id, asset]))
  const candidates = []

  transformOutsideCode(masked, (chunk, offset) => {
    for (const match of chunk.matchAll(new RegExp(IMAGE_SOURCE, 'g'))) {
      const start = offset + match.index
      const end = start + match[0].length
      const raw = source.slice(start, end)
      const src = match[2]
      const assetId = src.startsWith('asset://') ? src.slice(8) : ''
      const asset = assetById.get(assetId)
      const alt = cleanCaption(match[1], asset?.name || 'figure')
      const caption = readCaption(source, end, 'figure')
      candidates.push({
        kind: 'figure', start, end, raw, assetId, key: assetId || slug(alt),
        alt, caption: caption.hasCaption ? caption.caption : alt,
        hasCaption: caption.hasCaption, captionKey: caption.key
      })
    }
    return chunk
  })

  const lines = masked.split('\n')
  const offsets = []
  let running = 0
  for (const line of lines) {
    offsets.push(running)
    running += line.length + 1
  }

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].includes('|') || !isTableSeparator(lines[index + 1])) continue
    let last = index + 1
    while (last + 1 < lines.length && lines[last + 1].includes('|') && lines[last + 1].trim()) last += 1
    const start = offsets[index]
    const end = offsets[last] + lines[last].length
    const caption = readCaption(source, end, 'table')
    candidates.push({
      kind: 'table', start, end, raw: source.slice(start, end), assetId: '',
      key: caption.key || '', alt: '', caption: caption.hasCaption ? caption.caption : 'Table caption',
      hasCaption: caption.hasCaption, captionKey: caption.key
    })
    index = last
  }

  candidates.sort((a, b) => a.start - b.start)
  let figureCount = 0
  let tableCount = 0
  return candidates.map((candidate) => {
    if (candidate.kind === 'figure') figureCount += 1
    else tableCount += 1
    const number = candidate.kind === 'figure' ? figureCount : tableCount
    const key = candidate.captionKey || candidate.key || `${candidate.kind}-${number}`
    return {
      ...candidate,
      id: `${candidate.kind}-${number}`,
      number,
      key,
      label: `${candidate.kind === 'figure' ? FIGURE_PREFIX : TABLE_PREFIX} ${number}`
    }
  })
}

/** Replace `@fig:` / `@tbl:` tokens with their computed labels. */
export function resolveCrossReferences(markdown, items = []) {
  const source = String(markdown || '')
  const labels = new Map()
  for (const item of items) {
    const type = item.kind === 'figure' ? 'fig' : 'tbl'
    labels.set(`${type}:${item.key}`.toLowerCase(), item.label)
  }
  const missing = []
  const output = transformOutsideCode(source, (chunk) => chunk.replace(new RegExp(CROSS_REF_SOURCE, 'gi'), (raw, type, key) => {
    const label = labels.get(`${type}:${key}`.toLowerCase())
    if (!label) { missing.push(raw); return raw }
    return label
  }))
  return { markdown: output, missing: [...new Set(missing)] }
}

/** Caption tokens become their plain number; body tokens become the full label. */
function resolveCaptionTokens(markdown, items = []) {
  const numbers = new Map()
  for (const item of items) {
    const type = item.kind === 'figure' ? 'fig' : 'tbl'
    numbers.set(`${type}:${item.key}`.toLowerCase(), String(item.number))
  }
  return String(markdown || '').replace(/\[@(fig|tbl):([A-Za-z0-9_-]+)\]/gi, (raw, type, key) => numbers.get(`${type}:${key}`.toLowerCase()) || raw)
}

/**
 * Add captions where needed, number them, and resolve cross-references for display.
 * The returned Markdown is display-ready; keep the original tokens in the draft.
 */
export function numberDocument(markdown, options = {}) {
  const source = String(markdown || '')
  const assets = Array.isArray(options.assets) ? options.assets : []
  const figurePrefix = options.figurePrefix || FIGURE_PREFIX
  const tablePrefix = options.tablePrefix || TABLE_PREFIX
  const firstPass = scanNumberables(source, assets)
  const insertions = firstPass
    .filter((item) => !item.hasCaption)
    .map((item) => {
      const prefix = item.kind === 'figure' ? figurePrefix : tablePrefix
      const type = item.kind === 'figure' ? 'fig' : 'tbl'
      return { at: item.end, text: `\n\n*${prefix} [@${type}:${item.key}]. ${item.caption}*` }
    })
    .sort((a, b) => b.at - a.at)

  let numbered = source
  for (const insertion of insertions) {
    numbered = `${numbered.slice(0, insertion.at)}${insertion.text}${numbered.slice(insertion.at)}`
  }

  const items = scanNumberables(numbered, assets)
  const captioned = resolveCaptionTokens(numbered, items)
  const resolved = resolveCrossReferences(captioned, items)
  return { markdown: resolved.markdown, items, unresolved: resolved.missing }
}

export function buildFigureBlock(asset, caption = '') {
  const name = cleanCaption(asset?.name, 'figure')
  const key = String(asset?.id || slug(name, 'figure'))
  return `![${name}](asset://${key})\n\n*Figure [@fig:${key}]. ${cleanCaption(caption, name)}*`
}

export function buildTableBlock(rows = [], caption = '', key = '') {
  const tableRows = Array.isArray(rows) && rows.length ? rows : [['Metric', 'Value'], ['', '']]
  const header = tableRows[0].map((cell) => cleanCaption(cell))
  const line = (cells) => `| ${cells.map((cell) => String(cell).replace(/\|/g, '\\|')).join(' | ')} |`
  const body = tableRows.slice(1).map((row) => line(row.map((cell) => cleanCaption(cell))))
  const token = slug(key || caption, 'table')
  return `${line(header)}\n${line(header.map(() => '---'))}\n${body.join('\n')}\n\n*Table [@tbl:${token}]. ${cleanCaption(caption, 'Table caption')}*`
}
