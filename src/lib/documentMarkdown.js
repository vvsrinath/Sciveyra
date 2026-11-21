/**
 * Framework-free helpers shared by document import, Markdown editing and DOCX
 * export. The goal is a predictable, reviewable Markdown subset rather than a
 * perfect replica of Word or Google Docs.
 */

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'div', 'dl', 'dt', 'dd', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody',
  'td', 'tfoot', 'th', 'thead', 'tr', 'ul'
])

const STRIPPED_TAGS = new Set(['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'button', 'svg'])

export function normalizeLineEndings(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n')
}

export function collapseBlankLines(value) {
  return normalizeLineEndings(value).replace(/\n{3,}/g, '\n\n').trim()
}

/** Reject executable URLs while keeping the link forms a local draft needs. */
export function sanitizeUrl(value, { image = false } = {}) {
  const url = String(value ?? '').trim().replace(/&amp;/g, '&')
  if (!url) return ''
  if (/^(https?:|mailto:|tel:|blob:)/i.test(url)) return url
  if (/^asset:\/\/[a-z0-9_-]+$/i.test(url)) return url
  if (/^(\/|\.\/|\.\.\/)/.test(url)) return url
  if (image && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(url)) return url
  return ''
}

function cleanTextNode(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
}

function inlineFromChildren(node) {
  return [...(node?.childNodes || [])].map(inlineNode).join('').replace(/[ \t]{2,}/g, ' ').trim()
}

function inlineNode(node) {
  if (node.nodeType === 3) return cleanTextNode(node.nodeValue)
  if (node.nodeType !== 1) return ''
  const tag = node.nodeName.toLowerCase()
  if (STRIPPED_TAGS.has(tag)) return ''
  if (tag === 'br') return '  \n'

  const children = [...(node.childNodes || [])].map(inlineNode).join('')
  const style = String(node.getAttribute?.('style') || '')
  const bold = /font-weight:\s*(?:bold|[6-9]\d{2})/i.test(style)
  const italic = /font-style:\s*italic/i.test(style)
  const underline = /text-decoration[^;]*underline/i.test(style)

  if (tag === 'img') {
    const src = sanitizeUrl(node.getAttribute('src') || node.getAttribute('data-src'), { image: true })
    if (!src) return ''
    const alt = String(node.getAttribute('alt') || 'image').replace(/[[\]]/g, '').trim()
    return `![${alt || 'image'}](${src})`
  }
  if (tag === 'a') {
    const href = sanitizeUrl(node.getAttribute('href'))
    const label = children.replace(/\s+/g, ' ').trim() || href
    return href ? `[${label}](${href})` : label
  }
  if (tag === 'code' || tag === 'kbd') return children.trim() ? `\`${children.trim().replace(/`/g, "'")}\`` : ''
  if (tag === 'strong' || tag === 'b' || bold) return children.trim() ? `**${children.trim()}**` : ''
  if (tag === 'em' || tag === 'i' || italic) return children.trim() ? `*${children.trim()}*` : ''
  if (tag === 'u' || underline) return children.trim() ? `<u>${children.trim()}</u>` : ''
  if (tag === 's' || tag === 'strike' || tag === 'del') return children.trim() ? `~~${children.trim()}~~` : ''
  if (tag === 'sup') return children.trim() ? `<sup>${children.trim()}</sup>` : ''
  if (tag === 'sub') return children.trim() ? `<sub>${children.trim()}</sub>` : ''
  return children
}

function flushText(state) {
  const value = state.text.replace(/[ \t]+\n/g, '  \n').trim()
  if (value) state.lines.push(value)
  state.text = ''
}

function splitTableRow(row) {
  return [...row.children]
    .filter((cell) => ['td', 'th'].includes(cell.nodeName.toLowerCase()))
    .map((cell) => inlineFromChildren(cell).replace(/\|/g, '\\|') || ' ')
}

function renderList(list, depth = 0) {
  const ordered = list.nodeName.toLowerCase() === 'ol'
  let index = Number(list.getAttribute('start')) || 1
  const lines = []
  for (const child of list.children || []) {
    const tag = child.nodeName.toLowerCase()
    if (tag !== 'li') continue
    const nested = []
    const itemState = { lines: [], text: '' }
    for (const node of child.childNodes || []) {
      if (node.nodeType === 1 && ['ul', 'ol'].includes(node.nodeName.toLowerCase())) nested.push(node)
      else renderNode(node, itemState)
    }
    flushText(itemState)
    const marker = ordered ? `${index}. ` : '- '
    const first = itemState.lines.shift() || ''
    lines.push(`${'  '.repeat(depth)}${marker}${first}`)
    for (const line of itemState.lines) lines.push(`${'  '.repeat(depth + 1)}${line}`)
    for (const childList of nested) lines.push(...renderList(childList, depth + 1))
    index += 1
  }
  return lines
}

function renderNode(node, state) {
  if (node.nodeType === 3) {
    state.text += cleanTextNode(node.nodeValue)
    return
  }
  if (node.nodeType !== 1) return
  const tag = node.nodeName.toLowerCase()
  if (STRIPPED_TAGS.has(tag)) return

  if (tag === 'br') { state.text += '  \n'; return }
  if (/^h[1-6]$/.test(tag)) {
    flushText(state)
    const text = inlineFromChildren(node)
    if (text) state.lines.push(`${'#'.repeat(Number(tag[1]))} ${text}`, '')
    return
  }
  if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'figure' || tag === 'figcaption') {
    const before = state.lines.length
    for (const child of node.childNodes || []) renderNode(child, state)
    flushText(state)
    if (state.lines.length > before) state.lines.push('')
    return
  }
  if (tag === 'ul' || tag === 'ol') {
    flushText(state)
    state.lines.push(...renderList(node), '')
    return
  }
  if (tag === 'blockquote') {
    flushText(state)
    const inner = { lines: [], text: '' }
    for (const child of node.childNodes || []) renderNode(child, inner)
    flushText(inner)
    if (inner.lines.length) state.lines.push(...inner.lines.map((line) => `> ${line}`), '')
    return
  }
  if (tag === 'pre') {
    flushText(state)
    const text = normalizeLineEndings(node.textContent || '').trim()
    if (text) state.lines.push('```', text, '```', '')
    return
  }
  if (tag === 'hr') { flushText(state); state.lines.push('---', ''); return }
  if (tag === 'table') {
    flushText(state)
    const rows = [...node.querySelectorAll('tr')].map(splitTableRow).filter((row) => row.length)
    if (rows.length) {
      const width = Math.max(...rows.map((row) => row.length))
      const pad = (row) => [...row, ...Array(Math.max(0, width - row.length)).fill(' ')]
      state.lines.push(`| ${pad(rows[0]).join(' | ')} |`)
      state.lines.push(`| ${Array(width).fill('---').join(' | ')} |`)
      for (const row of rows.slice(1)) state.lines.push(`| ${pad(row).join(' | ')} |`)
      state.lines.push('')
    }
    return
  }
  if (tag === 'img') {
    state.text += inlineNode(node)
    return
  }
  if (BLOCK_TAGS.has(tag)) {
    flushText(state)
    for (const child of node.childNodes || []) renderNode(child, state)
    flushText(state)
    state.lines.push('')
    return
  }
  state.text += inlineNode(node)
}

/** Convert Word/Google Docs clipboard HTML into the draft's Markdown subset. */
export function htmlToMarkdown(html) {
  const source = String(html ?? '').trim()
  if (!source) return ''
  if (typeof DOMParser === 'undefined') throw new Error('HTML conversion requires a browser environment.')
  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html')
  for (const node of doc.querySelectorAll('script,style,noscript,iframe,object,embed,button,svg')) node.remove()
  const state = { lines: [], text: '' }
  for (const child of doc.body.childNodes || []) renderNode(child, state)
  flushText(state)
  return collapseBlankLines(state.lines.join('\n'))
}

/** Plain text becomes paragraphs with hard line breaks; existing Markdown is preserved. */
export function plainTextToMarkdown(text) {
  const value = normalizeLineEndings(text).trim()
  if (!value) return ''
  if (/^\s{0,3}#{1,6}\s/m.test(value) || /^\s*[-*+]\s/m.test(value) || /^\s*\d+[.)]\s/m.test(value)
    || /\[[^\]]+\]\([^)]+\)/.test(value) || /!\[[^\]]*\]\([^)]+\)/.test(value)) return value
  return collapseBlankLines(value.split(/\n\s*\n/).map((block) => block
    .split('\n').map((line) => line.trimEnd()).join('  \n')).join('\n\n'))
}

const INLINE_PATTERN = /!\[(?<imageAlt>[^\]]*)\]\((?<imageSrc>[^)\s]+)(?:\s+"[^"]*")?\)|\[(?<linkLabel>[^\]]+)\]\((?<linkHref>[^)\s]+)(?:\s+"[^"]*")?\)|\*\*(?<strongA>[^*\n]+)\*\*|__(?<strongB>[^_\n]+)__|\*(?<emA>[^*\n]+)\*|_(?<emB>[^_\n]+)_|~~(?<strike>[^~\n]+)~~|`(?<code>[^`\n]+)`|<u>(?<underline>[\s\S]*?)<\/u>|<sup>(?<sup>[\s\S]*?)<\/sup>|<sub>(?<sub>[\s\S]*?)<\/sub>|<br\s*\/?>/gi

/** Parse the supported inline Markdown subset into small, testable tokens. */
export function parseInline(text) {
  const source = String(text ?? '')
  const runs = []
  const pattern = new RegExp(INLINE_PATTERN.source, INLINE_PATTERN.flags)
  let lastIndex = 0
  let match
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) runs.push({ type: 'text', text: source.slice(lastIndex, match.index) })
    const groups = match.groups || {}
    if (groups.imageAlt !== undefined) runs.push({ type: 'image', text: groups.imageAlt, src: sanitizeUrl(groups.imageSrc, { image: true }) || groups.imageSrc })
    else if (groups.linkLabel !== undefined) runs.push({ type: 'link', text: groups.linkLabel, href: sanitizeUrl(groups.linkHref) || groups.linkHref, children: parseInline(groups.linkLabel) })
    else if (groups.strongA !== undefined || groups.strongB !== undefined) {
      const value = groups.strongA ?? groups.strongB
      runs.push({ type: 'strong', text: value, children: parseInline(value) })
    } else if (groups.emA !== undefined || groups.emB !== undefined) {
      const value = groups.emA ?? groups.emB
      runs.push({ type: 'em', text: value, children: parseInline(value) })
    } else if (groups.strike !== undefined) runs.push({ type: 'strike', text: groups.strike, children: parseInline(groups.strike) })
    else if (groups.code !== undefined) runs.push({ type: 'code', text: groups.code })
    else if (groups.underline !== undefined) runs.push({ type: 'underline', text: groups.underline, children: parseInline(groups.underline) })
    else if (groups.sup !== undefined) runs.push({ type: 'sup', text: groups.sup, children: parseInline(groups.sup) })
    else if (groups.sub !== undefined) runs.push({ type: 'sub', text: groups.sub, children: parseInline(groups.sub) })
    else runs.push({ type: 'break' })
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < source.length) runs.push({ type: 'text', text: source.slice(lastIndex) })
  return runs.filter((run) => run.type !== 'text' || run.text)
}

function splitCells(line) {
  return String(line).trim().replace(/^\|+/, '').replace(/\|+$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'))
}

function isTableSeparator(line) {
  return /\|/.test(line) && /^[\s|:-]+$/.test(line) && /-/.test(line)
}

function isBlockStart(line) {
  return /^\s*```/.test(line) || /^\s{0,3}#{1,6}\s/.test(line) || /^\s*>/.test(line)
    || /^\s*[-*+]\s/.test(line) || /^\s*\d+[.)]\s/.test(line) || /^\s*(---|\*\*\*)\s*$/.test(line)
}

/** Parse the draft into block tokens used by DOCX export and plain-text export. */
export function parseMarkdown(markdown) {
  const lines = normalizeLineEndings(markdown).trim().split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i += 1; continue }

    if (/^\s*```/.test(line)) {
      const lang = line.trim().replace(/^```/, '').trim()
      i += 1
      const body = []
      while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i += 1 }
      if (i < lines.length) i += 1
      blocks.push({ type: 'code', lang, text: body.join('\n') })
      continue
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      i += 1
      continue
    }

    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      blocks.push({ type: 'rule' })
      i += 1
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const rows = [splitCells(line)]
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(splitCells(lines[i])); i += 1 }
      blocks.push({ type: 'table', rows })
      continue
    }

    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      const items = []
      while (i < lines.length) {
        const item = lines[i].match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)
        if (!item) break
        items.push(item[1].trim())
        i += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    if (/^\s*>/.test(line)) {
      const body = []
      while (i < lines.length && /^\s*>/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, '')); i += 1 }
      blocks.push({ type: 'quote', text: collapseBlankLines(body.join('\n')) })
      continue
    }

    const paragraph = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) { paragraph.push(lines[i]); i += 1 }
    blocks.push({ type: 'paragraph', text: paragraph.map((part) => part.trim()).join(' ').replace(/\s{2,}/g, ' ') })
  }
  return blocks
}

function runsToPlainText(runs) {
  return runs.map((run) => {
    if (run.type === 'break') return '\n'
    if (run.type === 'image') return `[Image: ${run.text || 'image'}]`
    if (run.type === 'link') return `${runsToPlainText(run.children || parseInline(run.text))}${run.href ? ` (${run.href})` : ''}`
    return run.text || runsToPlainText(run.children || [])
  }).join('')
}

/** Flatten Markdown into readable text for TXT export and previews. */
export function markdownToPlainText(markdown) {
  const lines = []
  for (const block of parseMarkdown(markdown)) {
    if (block.type === 'rule') lines.push('---')
    else if (block.type === 'heading') lines.push(`${'#'.repeat(block.level)} ${runsToPlainText(parseInline(block.text))}`)
    else if (block.type === 'code') lines.push(block.text)
    else if (block.type === 'quote') lines.push(`> ${runsToPlainText(parseInline(block.text))}`)
    else if (block.type === 'list') block.items.forEach((item, index) => lines.push(`${block.ordered ? `${index + 1}.` : '-'} ${runsToPlainText(parseInline(item))}`))
    else if (block.type === 'table') {
      for (const row of block.rows) lines.push(row.map((cell) => runsToPlainText(parseInline(cell))).join(' | '))
    } else lines.push(runsToPlainText(parseInline(block.text)))
    lines.push('')
  }
  return collapseBlankLines(lines.join('\n'))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function runsToHtml(runs, options) {
  return runs.map((run) => {
    if (run.type === 'text') return escapeHtml(run.text)
    if (run.type === 'break') return '<br />'
    if (run.type === 'strong') return `<strong>${runsToHtml(run.children || [], options)}</strong>`
    if (run.type === 'em') return `<em>${runsToHtml(run.children || [], options)}</em>`
    if (run.type === 'underline') return `<u>${runsToHtml(run.children || [], options)}</u>`
    if (run.type === 'strike') return `<del>${runsToHtml(run.children || [], options)}</del>`
    if (run.type === 'code') return `<code>${escapeHtml(run.text)}</code>`
    if (run.type === 'sup') return `<sup>${runsToHtml(run.children || [], options)}</sup>`
    if (run.type === 'sub') return `<sub>${runsToHtml(run.children || [], options)}</sub>`
    if (run.type === 'link') {
      const href = sanitizeUrl(run.href)
      const label = runsToHtml(run.children || parseInline(run.text), options)
      return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>` : label
    }
    if (run.type === 'image') {
      const assetId = String(run.src || '').match(/^asset:\/\/([a-z0-9_-]+)$/i)?.[1]
      const src = assetId ? options.resolveSource?.(assetId) || '' : sanitizeUrl(run.src, { image: true })
      return src
        ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(run.text || 'figure')}" />`
        : `<span class="missing-asset">[Image: ${escapeHtml(run.text || 'figure')}]</span>`
    }
    return ''
  }).join('')
}

/** Render a sanitised read-only preview of the supported Markdown subset. */
export function markdownToHtml(markdown, options = {}) {
  const html = []
  for (const block of parseMarkdown(markdown)) {
    if (block.type === 'rule') html.push('<hr />')
    else if (block.type === 'heading') {
      const level = Math.max(1, Math.min(6, block.level))
      html.push(`<h${level}>${runsToHtml(parseInline(block.text), options)}</h${level}>`)
    } else if (block.type === 'code') html.push(`<pre><code>${escapeHtml(block.text)}</code></pre>`)
    else if (block.type === 'quote') html.push(`<blockquote>${runsToHtml(parseInline(block.text), options)}</blockquote>`)
    else if (block.type === 'list') {
      const tag = block.ordered ? 'ol' : 'ul'
      html.push(`<${tag}>${block.items.map((item) => `<li>${runsToHtml(parseInline(item), options)}</li>`).join('')}</${tag}>`)
    } else if (block.type === 'table') {
      const [header, ...rest] = block.rows
      html.push('<table>')
      html.push(`<thead><tr>${header.map((cell) => `<th>${runsToHtml(parseInline(cell), options)}</th>`).join('')}</tr></thead>`)
      html.push(`<tbody>${rest.map((row) => `<tr>${row.map((cell) => `<td>${runsToHtml(parseInline(cell), options)}</td>`).join('')}</tr>`).join('')}</tbody>`)
      html.push('</table>')
    } else html.push(`<p>${runsToHtml(parseInline(block.text), options)}</p>`)
  }
  return html.join('')
}

/** Extract a sensible draft title from imported content or fall back to a filename. */
export function titleFromMarkdown(markdown, fallback = '') {
  const heading = parseMarkdown(markdown).find((block) => block.type === 'heading' && block.level <= 2)
  const title = heading ? runsToPlainText(parseInline(heading.text)).replace(/^#+\s*/, '').trim() : ''
  return title || String(fallback || '').replace(/\.(md|markdown|txt|docx|html?)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Imported draft'
}
