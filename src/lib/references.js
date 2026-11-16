import { slugify, uid } from './util.js'

export const CITATION_STYLES = ['APA 7', 'IEEE', 'MLA 9', 'Chicago', 'Vancouver', 'Harvard', 'Nature', 'Science', 'ACS']

export const CITATION_STYLE_NOTES = {
  'APA 7': 'Author–date, sentence case, ampersand before final author.',
  IEEE: 'Numbered [1], initials first, quotation marks around article titles.',
  'MLA 9': 'Author–page style, full author names, “and” before the final author.',
  Chicago: 'Notes–bibliography author–date, full initial given names.',
  Vancouver: 'Numbered, superscripted style common in medicine.',
  Harvard: 'Author–date with (Author, year) in-text citations.',
  Nature: 'Numbered superscript style with abbreviated journal formatting.',
  Science: 'Numbered style with full journal names and initials.',
  ACS: 'American Chemical Society numbered style.'
}

export function normalizeReference(input = {}) {
  const authors = Array.isArray(input.authors)
    ? input.authors.filter(Boolean).map((author) => String(author).trim())
    : splitAuthors(input.authors)
  return {
    id: input.id || uid('ref'),
    type: ['article', 'book', 'chapter', 'conference', 'thesis', 'report', 'web', 'other'].includes(input.type) ? input.type : 'article',
    title: cleanText(input.title || 'Untitled reference'),
    authors,
    year: String(input.year || '').trim(),
    journal: cleanText(input.journal || input.publication || ''),
    volume: String(input.volume || '').trim(),
    issue: String(input.issue || input.number || '').trim(),
    pages: cleanText(input.pages || ''),
    doi: cleanDoi(input.doi || ''),
    url: String(input.url || '').trim(),
    publisher: cleanText(input.publisher || ''),
    abstract: cleanText(input.abstract || ''),
    notes: cleanText(input.notes || ''),
    key: cleanText(input.key || ''),
    source: cleanText(input.source || 'manual'),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function cleanDoi(value) {
  return String(value || '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
}

export function splitAuthors(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  return String(value)
    .split(/\s+and\s+|;\s*/i)
    .map((author) => author.trim())
    .filter(Boolean)
}

export function parseBibTeX(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The BibTeX file is empty.')
  const references = []
  const errors = []
  let index = 0
  while (index < text.length) {
    const at = text.indexOf('@', index)
    if (at === -1) break
    const match = text.slice(at).match(/^@([a-zA-Z]+)\s*[{(]/)
    if (!match) {
      index = at + 1
      continue
    }
    const type = match[1].toLowerCase()
    const openIndex = at + match[0].length - 1
    const closeIndex = findMatching(text, openIndex, match[0].slice(-1) === '{' ? '{' : '(')
    if (closeIndex === -1) {
      errors.push(`Entry beginning at character ${at + 1} has no closing delimiter.`)
      break
    }
    const body = text.slice(openIndex + 1, closeIndex)
    try {
      references.push(parseBibEntry(type, body))
    } catch (error) {
      errors.push(error.message)
    }
    index = closeIndex + 1
  }
  if (!references.length) throw new Error('No BibTeX entries could be parsed. Check the file format.')
  return { references, errors }
}

function findMatching(text, start, open) {
  const close = open === '{' ? '}' : ')'
  let depth = 0
  let inQuote = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (char === '\\') {
      index += 1
      continue
    }
    if (char === '"' && open === '{') inQuote = !inQuote
    if (inQuote) continue
    if (char === open) depth += 1
    else if (char === close) {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

function parseBibEntry(type, body) {
  let index = 0
  while (index < body.length && body[index] !== ',') index += 1
  const key = body.slice(0, index).trim()
  const fields = {}
  index += 1
  while (index < body.length) {
    while (index < body.length && /[\s,]/.test(body[index])) index += 1
    if (index >= body.length) break
    let name = ''
    while (index < body.length && /[a-zA-Z0-9_-]/.test(body[index])) {
      name += body[index]
      index += 1
    }
    while (index < body.length && /\s/.test(body[index])) index += 1
    if (body[index] !== '=') {
      while (index < body.length && body[index] !== ',') index += 1
      index += 1
      continue
    }
    index += 1
    while (index < body.length && /\s/.test(body[index])) index += 1
    let value = ''
    if (body[index] === '{') {
      const end = findMatching(body, index, '{')
      if (end === -1) throw new Error(`Field "${name}" is missing a closing brace in entry "${key}".`)
      value = body.slice(index + 1, end)
      index = end + 1
    } else if (body[index] === '"') {
      index += 1
      while (index < body.length) {
        if (body[index] === '\\') {
          value += body[index] + (body[index + 1] || '')
          index += 2
          continue
        }
        if (body[index] === '"') { index += 1; break }
        value += body[index]
        index += 1
      }
    } else {
      while (index < body.length && body[index] !== ',') {
        value += body[index]
        index += 1
      }
    }
    fields[name.toLowerCase()] = cleanLatex(value)
    while (index < body.length && body[index] !== ',') index += 1
    index += 1
  }
  const typeMap = {
    article: 'article',
    inproceedings: 'conference',
    conference: 'conference',
    book: 'book',
    incollection: 'chapter',
    inbook: 'chapter',
    phdthesis: 'thesis',
    mastersthesis: 'thesis',
    techreport: 'report',
    report: 'report',
    misc: 'other',
    online: 'web',
    unpublished: 'other'
  }
  return normalizeReference({
    type: typeMap[type] || 'other',
    key,
    title: fields.title || fields.booktitle || 'Untitled reference',
    authors: splitAuthors(fields.author || fields.editor || ''),
    year: fields.year || fields.date || '',
    journal: fields.journal || fields.booktitle || fields.journaltitle || '',
    volume: fields.volume || '',
    issue: fields.number || fields.issue || '',
    pages: fields.pages || '',
    doi: fields.doi || '',
    url: fields.url || '',
    publisher: fields.publisher || fields.school || fields.institution || '',
    abstract: fields.abstract || '',
    notes: fields.note || '',
    source: 'bibtex'
  })
}

function cleanLatex(value) {
  return String(value || '')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\(?:textit|textbf|emph|mathrm|mathit|text)\{([^{}]*)\}/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/~+/g, ' ')
    .trim()
}

export function parseRIS(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The RIS file is empty.')
  const records = text.replace(/\r/g, '').split(/^ER\s*$/m)
  const references = []
  const errors = []
  for (const [recordIndex, record] of records.entries()) {
    if (!record.trim()) continue
    const fields = {}
    for (const line of record.split('\n')) {
      const match = line.match(/^([A-Z0-9]{2})\s+-\s?(.*)$/)
      if (!match) continue
      const [, tag, value] = match
      if (!fields[tag]) fields[tag] = []
      fields[tag].push(value.trim())
    }
    if (!Object.keys(fields).length) {
      errors.push(`RIS record ${recordIndex + 1} contained no fields.`)
      continue
    }
    const first = (tags) => fields[tags]?.find((value) => value) || ''
    const pages = [first('SP'), first('EP')].filter(Boolean).join('–')
    const type = first('TY')
    const typeMap = { JOUR: 'article', BOOK: 'book', CHAP: 'chapter', CONF: 'conference', THES: 'thesis', RPRT: 'report', ELEC: 'web', GEN: 'other' }
    references.push(normalizeReference({
      type: typeMap[type] || 'other',
      title: first('TI') || first('T1') || 'Untitled reference',
      authors: fields.AU || fields.A1 || [],
      year: (first('PY') || first('Y1')).match(/\d{4}/)?.[0] || '',
      journal: first('JO') || first('JF') || first('T2') || '',
      volume: first('VL'),
      issue: first('IS'),
      pages,
      doi: first('DO'),
      url: first('UR'),
      publisher: first('PB'),
      abstract: first('AB') || first('N2'),
      notes: first('N1'),
      source: 'ris'
    }))
  }
  if (!references.length) throw new Error('No RIS records could be parsed. Check the file format.')
  return { references, errors }
}

export function referenceKey(reference) {
  if (reference.key) return reference.key
  const author = reference.authors?.[0]?.split(/[\s,]+/).filter(Boolean).pop() || 'reference'
  const year = reference.year || 'nd'
  const titleWord = String(reference.title || '').split(/\s+/).find((word) => word.length > 2) || 'untitled'
  return `${slugify(author, 'ref')}${year}${slugify(titleWord, '')}`.slice(0, 40)
}

export function exportBibTeX(references) {
  return (references || []).map((reference) => {
    const type = reference.type === 'conference' ? 'inproceedings'
      : reference.type === 'chapter' ? 'incollection'
      : reference.type === 'thesis' ? 'phdthesis'
      : reference.type === 'report' ? 'techreport'
      : reference.type === 'web' ? 'misc'
      : reference.type === 'book' ? 'book'
      : 'article'
    const fields = [
      ['title', reference.title],
      ['author', (reference.authors || []).join(' and ')],
      ['year', reference.year],
      ['journal', reference.journal],
      ['volume', reference.volume],
      ['number', reference.issue],
      ['pages', reference.pages],
      ['doi', reference.doi],
      ['url', reference.url],
      ['publisher', reference.publisher],
      ['abstract', reference.abstract],
      ['note', reference.notes]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    return `@${type}{${referenceKey(reference)},\n${fields.map(([name, value]) => `  ${name} = {${escapeBibValue(value)}}`).join(',\n')}\n}`
  }).join('\n\n')
}

function escapeBibValue(value) {
  return String(value).replace(/[{}\\]/g, (char) => `\\${char}`).replace(/\n+/g, ' ')
}

export function exportRIS(references) {
  const typeMap = { article: 'JOUR', book: 'BOOK', chapter: 'CHAP', conference: 'CONF', thesis: 'THES', report: 'RPRT', web: 'ELEC', other: 'GEN' }
  return (references || []).map((reference) => {
    const lines = [`TY  - ${typeMap[reference.type] || 'GEN'}`]
    if (reference.title) lines.push(`TI  - ${reference.title}`)
    for (const author of reference.authors || []) lines.push(`AU  - ${author}`)
    if (reference.year) lines.push(`PY  - ${reference.year}`)
    if (reference.journal) lines.push(`JO  - ${reference.journal}`)
    if (reference.volume) lines.push(`VL  - ${reference.volume}`)
    if (reference.issue) lines.push(`IS  - ${reference.issue}`)
    if (reference.pages) lines.push(`SP  - ${reference.pages}`)
    if (reference.doi) lines.push(`DO  - ${reference.doi}`)
    if (reference.url) lines.push(`UR  - ${reference.url}`)
    if (reference.publisher) lines.push(`PB  - ${reference.publisher}`)
    if (reference.abstract) lines.push(`AB  - ${reference.abstract}`)
    if (reference.notes) lines.push(`N1  - ${reference.notes}`)
    lines.push('ER  - ')
    return lines.join('\n')
  }).join('\n\n')
}

export function dedupeReferences(references) {
  const seen = new Set()
  const unique = []
  for (const reference of references || []) {
    const doi = cleanDoi(reference.doi).toLowerCase()
    const titleKey = String(reference.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80)
    const keys = []
    if (doi) keys.push(`doi:${doi}`)
    if (titleKey) keys.push(`title:${titleKey}|${reference.year || ''}`)
    if (!keys.length) {
      unique.push(reference)
      continue
    }
    if (keys.some((key) => seen.has(key))) continue
    for (const key of keys) seen.add(key)
    unique.push(reference)
  }
  return unique
}

export function findDuplicate(references, candidate) {
  const doi = cleanDoi(candidate.doi).toLowerCase()
  return (references || []).find((reference) => {
    if (doi && cleanDoi(reference.doi).toLowerCase() === doi) return true
    return String(reference.title || '').toLowerCase().replace(/[^a-z0-9]/g, '') === String(candidate.title || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      && String(reference.year || '') === String(candidate.year || '')
  }) || null
}

const NAME_SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v|ph\.?d\.?|m\.?d\.?)$/i

function authorParts(author) {
  const value = String(author || '').trim()
  if (!value) return { family: '', given: '', suffix: '' }
  if (value.includes(',')) {
    const segments = value.split(',').map((part) => part.trim()).filter(Boolean)
    const family = segments[0] || ''
    let suffix = ''
    const rest = segments.slice(1)
    const last = rest[rest.length - 1]
    if (rest.length > 1 && last && NAME_SUFFIX.test(last)) {
      suffix = last
      rest.pop()
    }
    return { family, given: rest.join(' '), suffix }
  }
  const parts = value.split(/\s+/).filter(Boolean)
  let suffix = ''
  if (parts.length > 1 && NAME_SUFFIX.test(parts[parts.length - 1])) {
    suffix = parts.pop()
  }
  const family = parts.length > 1 ? parts.pop() : parts[0] || ''
  return { family, given: parts.join(' '), suffix }
}

function initials(given) {
  return String(given || '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(' ')
}

function compactInitials(given) {
  return String(given || '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function givenName(given) {
  return String(given || '').trim()
}

export function formatAPA(reference) {
  const authors = reference.authors || []
  let authorText = ''
  if (authors.length === 1) {
    const { family, given } = authorParts(authors[0])
    authorText = `${family}, ${initials(given)}`
  } else if (authors.length > 1) {
    const formatted = authors.slice(0, 20).map((author) => {
      const { family, given } = authorParts(author)
      return `${family}, ${initials(given)}`
    })
    authorText = formatted.length === 2
      ? `${formatted[0]}, & ${formatted[1]}`
      : `${formatted.slice(0, -1).join(', ')}, & ${formatted[formatted.length - 1]}`
  }
  const year = reference.year ? `(${reference.year}).` : '(n.d.).'
  const title = reference.title ? `${reference.title}.` : ''
  const journal = reference.journal ? `${reference.journal}` : ''
  const volume = reference.volume ? `, ${reference.volume}` : ''
  const issue = reference.issue ? `(${reference.issue})` : ''
  const pages = reference.pages ? `, ${reference.pages}` : ''
  const publication = journal ? `${journal}${volume}${issue}${pages}.` : ''
  const link = reference.doi ? ` https://doi.org/${cleanDoi(reference.doi)}` : reference.url ? ` ${reference.url}` : ''
  const authorBlock = authorText ? `${authorText}${authorText.endsWith('.') ? ' ' : '. '}` : ''
  return `${authorBlock}${year} ${title} ${publication}${link}`.replace(/\s+/g, ' ').trim()
}

export function formatIEEE(reference, index = 1) {
  const authors = (reference.authors || []).map((author) => {
    const { family, given } = authorParts(author)
    return `${initials(given)} ${family}`.trim()
  })
  const authorText = authors.length === 2
    ? `${authors[0]} and ${authors[1]}`
    : authors.length > 2
      ? `${authors.slice(0, -1).join(', ')}, and ${authors[authors.length - 1]}`
      : authors[0] || ''
  const title = reference.title ? `"${reference.title},"` : ''
  const journal = reference.journal ? `${title ? ' ' : ''}${reference.journal}` : ''
  const volume = reference.volume ? `, vol. ${reference.volume}` : ''
  const issue = reference.issue ? `, no. ${reference.issue}` : ''
  const pages = reference.pages ? `, pp. ${reference.pages}` : ''
  const year = reference.year ? `, ${reference.year}` : ''
  const doi = reference.doi ? `, doi: ${cleanDoi(reference.doi)}` : reference.url ? `, [Online]. Available: ${reference.url}` : ''
  return `[${index}] ${authorText ? `${authorText}, ` : ''}${title}${journal}${volume}${issue}${pages}${year}${doi}.`
}

export function formatMLA(reference) {
  const authors = reference.authors || []
  let authorText = ''
  if (authors.length) {
    const first = authorParts(authors[0])
    authorText = `${first.family}, ${first.given}`
    if (authors.length === 2) {
      const second = authorParts(authors[1])
      authorText += `, and ${second.given} ${second.family}`
    } else if (authors.length > 2) {
      authorText += ', et al'
    }
  }
  const title = reference.title ? `"${reference.title}."` : ''
  const journal = reference.journal ? `${reference.journal}` : ''
  const volume = reference.volume ? `, vol. ${reference.volume}` : ''
  const issue = reference.issue ? `, no. ${reference.issue}` : ''
  const year = reference.year ? `, ${reference.year}` : ''
  const pages = reference.pages ? `, pp. ${reference.pages}` : ''
  const doi = reference.doi ? `, https://doi.org/${cleanDoi(reference.doi)}` : reference.url ? `, ${reference.url}` : ''
  return `${authorText ? `${authorText}. ` : ''}${title} ${journal}${volume}${issue}${year}${pages}${doi}.`.replace(/\s+/g, ' ').replace(' .', '.').trim()
}

export function formatChicago(reference) {
  const authors = reference.authors || []
  let authorText = ''
  if (authors.length) {
    const first = authorParts(authors[0])
    authorText = `${first.family}, ${first.given}`
    if (authors.length > 1) {
      const rest = authors.slice(1).map((author) => {
        const parts = authorParts(author)
        return `${parts.given} ${parts.family}`.trim()
      })
      authorText += `${authors.length === 2 ? ', and ' : ', '}${rest.join(', ')}`
    }
  }
  const year = reference.year ? ` (${reference.year})` : ''
  const title = reference.title ? `"${reference.title}."` : ''
  const journal = reference.journal ? `${reference.journal}` : ''
  const volume = reference.volume ? ` ${reference.volume}` : ''
  const issue = reference.issue ? `, no. ${reference.issue}` : ''
  const pages = reference.pages ? `: ${reference.pages}` : ''
  const doi = reference.doi ? `, https://doi.org/${cleanDoi(reference.doi)}` : reference.url ? `, ${reference.url}` : ''
  return `${authorText ? `${authorText} ` : ''}${year} ${title} ${journal}${volume}${issue}${pages}${doi}.`.replace(/\s+/g, ' ').replace(' .', '.').trim()
}

export function formatVancouver(reference, index = 1) {
  const authors = (reference.authors || []).slice(0, 6).map((author) => {
    const { family, given, suffix } = authorParts(author)
    return `${family} ${compactInitials(given)}${suffix ? ` ${suffix}` : ''}`.trim()
  })
  const authorText = authors.length > 6 ? `${authors.slice(0, 6).join(', ')}, et al` : authors.join(', ')
  const title = reference.title ? `${reference.title}.` : ''
  const journal = reference.journal ? `${reference.journal}.` : ''
  const year = reference.year ? `${reference.year}` : ''
  const volume = reference.volume ? `;${reference.volume}` : ''
  const issue = reference.issue ? `(${reference.issue})` : ''
  const pages = reference.pages ? `:${reference.pages}` : ''
  const doi = reference.doi ? ` doi:${cleanDoi(reference.doi)}.` : reference.url ? ` Available from: ${reference.url}.` : ''
  return `${index}. ${authorText ? `${authorText}. ` : ''}${title} ${journal} ${year}${volume}${issue}${pages}.${doi}`.replace(/\s+/g, ' ').replace(' .', '.').trim()
}

export function formatHarvard(reference) {
  const authors = (reference.authors || []).map((author) => {
    const { family, given } = authorParts(author)
    return `${family}, ${compactInitials(given)}`
  })
  const authorText = authors.length > 1
    ? `${authors.slice(0, -1).join(', ')} and ${authors[authors.length - 1]}`
    : authors[0] || ''
  const year = reference.year ? `(${reference.year})` : '(no date)'
  const title = reference.title ? `'${reference.title}',` : ''
  const journal = reference.journal ? `${reference.journal},` : ''
  const volume = reference.volume ? `${reference.volume}` : ''
  const issue = reference.issue ? `(${reference.issue})` : ''
  const pages = reference.pages ? `, pp. ${reference.pages}` : ''
  const doi = reference.doi ? `. doi: ${cleanDoi(reference.doi)}` : reference.url ? `. Available at: ${reference.url}` : ''
  return `${authorText ? `${authorText} ` : ''}${year} ${title} ${journal}${volume}${issue}${pages}${doi}.`.replace(/\s+/g, ' ').replace(' .', '.').trim()
}

export function formatNature(reference, index = 1) {
  const authors = (reference.authors || []).slice(0, 5).map((author) => {
    const { family, given } = authorParts(author)
    return `${family}, ${compactInitials(given)}`
  })
  const authorText = authors.length > 5 ? `${authors.slice(0, 5).join(', ')}, et al.` : authors.join(', ')
  const title = reference.title ? `${reference.title}.` : ''
  const journal = reference.journal ? `${abbreviateJournal(reference.journal)}` : ''
  const volume = reference.volume ? ` ${reference.volume},` : ''
  const pages = reference.pages ? ` ${reference.pages}` : ''
  const year = reference.year ? ` (${reference.year}).` : ''
  const doi = reference.doi ? ` https://doi.org/${cleanDoi(reference.doi)}` : ''
  return `${authorText ? `${authorText} ` : ''}${title} ${journal}${volume}${pages}${year}${doi}`.replace(/\s+/g, ' ').trim()
}

export function formatScience(reference, index = 1) {
  const authors = (reference.authors || []).slice(0, 5).map((author) => {
    const { family, given } = authorParts(author)
    return `${family}, ${compactInitials(given)}`
  })
  const authorText = authors.length > 5 ? `${authors.slice(0, 5).join(', ')}, et al.` : authors.join(', ')
  const title = reference.title ? `${reference.title}.` : ''
  const journal = reference.journal ? `${reference.journal}` : ''
  const volume = reference.volume ? ` ${reference.volume},` : ''
  const pages = reference.pages ? ` ${reference.pages}` : ''
  const year = reference.year ? ` (${reference.year}).` : ''
  const doi = reference.doi ? ` doi:${cleanDoi(reference.doi)}` : ''
  return `${index}. ${authorText ? `${authorText} ` : ''}${title} ${journal}${volume}${pages}${year}${doi}`.replace(/\s+/g, ' ').trim()
}

export function formatACS(reference, index = 1) {
  const authors = (reference.authors || []).slice(0, 10).map((author) => {
    const { family, given } = authorParts(author)
    return `${family}, ${compactInitials(given)}`
  })
  const authorText = authors.length > 10 ? `${authors.slice(0, 10).join(', ')}, et al.` : authors.join('; ')
  const title = reference.title ? `${reference.title}.` : ''
  const journal = reference.journal ? `${abbreviateJournal(reference.journal)}` : ''
  const year = reference.year ? ` ${reference.year},` : ''
  const volume = reference.volume ? ` ${reference.volume}` : ''
  const issue = reference.issue ? ` (${reference.issue})` : ''
  const pages = reference.pages ? `, ${reference.pages}` : ''
  const doi = reference.doi ? `. DOI: ${cleanDoi(reference.doi)}` : ''
  return `${authorText ? `${authorText} ` : ''}${title} ${journal}${year}${volume}${issue}${pages}${doi}.`.replace(/\s+/g, ' ').replace(' .', '.').trim()
}

const JOURNAL_ABBREVIATIONS = {
  'nature': 'Nature',
  'science': 'Science',
  'physical review letters': 'Phys. Rev. Lett.',
  'physical review b': 'Phys. Rev. B',
  'journal of the american chemical society': 'J. Am. Chem. Soc.',
  'journal of applied physics': 'J. Appl. Phys.',
  'applied physics letters': 'Appl. Phys. Lett.',
  'proceedings of the national academy of sciences': 'Proc. Natl. Acad. Sci. U.S.A.',
  'the lancet': 'Lancet',
  'new england journal of medicine': 'N. Engl. J. Med.'
}

export function abbreviateJournal(name) {
  const key = String(name || '').toLowerCase().trim()
  return JOURNAL_ABBREVIATIONS[key] || name
}

export function formatCitation(reference, style = 'APA 7', index = 1) {
  const normalized = normalizeReference(reference)
  switch (style) {
    case 'IEEE': return formatIEEE(normalized, index)
    case 'MLA 9': return formatMLA(normalized)
    case 'Chicago': return formatChicago(normalized)
    case 'Vancouver': return formatVancouver(normalized, index)
    case 'Harvard': return formatHarvard(normalized)
    case 'Nature': return formatNature(normalized, index)
    case 'Science': return formatScience(normalized, index)
    case 'ACS': return formatACS(normalized, index)
    default: return formatAPA(normalized)
  }
}

const NUMERIC_STYLES = new Set(['IEEE', 'Vancouver', 'Nature', 'Science', 'ACS'])

export function inlineCitation(reference, index = 1, style = 'APA 7') {
  if (NUMERIC_STYLES.has(style)) return `[${index}]`
  const authors = reference.authors || []
  if (!authors.length) return `(Anon., ${reference.year || 'n.d.'})`
  const family = authorParts(authors[0]).family
  const sep = style === 'MLA 9' || style === 'Harvard' ? ' and ' : ' & '
  if (authors.length === 1) return `(${family}, ${reference.year || 'n.d.'})`
  if (authors.length === 2) return `(${family}${sep}${authorParts(authors[1]).family}, ${reference.year || 'n.d.'})`
  return `(${family} et al., ${reference.year || 'n.d.'})`
}
