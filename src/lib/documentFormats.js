/**
 * Document import/export helpers. Word conversion uses Mammoth (BSD-2-Clause)
 * for import and docx (MIT) for export; both are loaded only on demand.
 */
import { blobToDataURL, svgToPngBlob } from './export.js'
import {
  collapseBlankLines, htmlToMarkdown, markdownToPlainText, parseMarkdown, parseInline,
  sanitizeUrl
} from './documentMarkdown.js'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024
export const MAX_EMBED_BYTES = 8 * 1024 * 1024
const ASSET_PATTERN = /(!?)\[([^\]]*)\]\(asset:\/\/([a-z0-9_-]+)(?:\s+"[^"]*")?\)/gi

export function documentKind(file) {
  const name = String(file?.name || '').toLowerCase()
  const mime = String(file?.type || '').toLowerCase()
  if (name.endsWith('.docx') || mime === DOCX_MIME) return 'docx'
  if (name.endsWith('.md') || name.endsWith('.markdown') || /markdown/.test(mime)) return 'md'
  if (name.endsWith('.txt') || /^text\/plain/.test(mime)) return 'txt'
  if (name.endsWith('.html') || name.endsWith('.htm') || /^text\/html/.test(mime)) return 'html'
  return ''
}

export function readArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('The file could not be read.'))
    reader.readAsArrayBuffer(blob)
  })
}

function base64EncodeBytes(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64EncodeText(text) {
  return base64EncodeBytes(new TextEncoder().encode(String(text)))
}

function dataUrlInfo(dataUrl) {
  const match = /^data:([^;,]*)?(;base64)?,([\s\S]*)$/i.exec(String(dataUrl || ''))
  if (!match) return null
  const mime = match[1] || 'application/octet-stream'
  const base64 = Boolean(match[2])
  const payload = match[3] || ''
  const bytes = base64
    ? Uint8Array.from(atob(payload), (character) => character.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload))
  return { mime, bytes }
}

function assetDataUrl(asset, warnings) {
  const data = String(asset?.data || '')
  if (!data) return ''
  if (data.startsWith('data:')) return data
  if (asset.kind === 'svg') return `data:image/svg+xml;base64,${base64EncodeText(data)}`
  if (asset.kind === 'image') return `data:image/png;base64,${base64EncodeBytes(Uint8Array.from(atob(data), (character) => character.charCodeAt(0)))}`
  warnings.push(`Saved asset "${asset.name}" has no embedded data and was left out.`)
  return ''
}

/** Replace local asset:// links with embedded data URLs so exports stay portable. */
export function resolveAssetReferences(markdown, assets = []) {
  const warnings = []
  const byId = new Map((assets || []).filter((asset) => asset?.id).map((asset) => [asset.id, asset]))
  let totalBytes = 0
  const output = String(markdown || '').replace(ASSET_PATTERN, (whole, bang, label, id) => {
    const asset = byId.get(id)
    const name = String(label || asset?.name || 'asset').trim() || 'asset'
    if (!asset) {
      warnings.push(`Saved asset ${id} was not found; inserted a text placeholder.`)
      return bang ? `[Missing image: ${name}]` : `${name} (saved asset unavailable)`
    }
    const src = assetDataUrl(asset, warnings)
    if (!src) return bang ? `[Unavailable image: ${name}]` : `${name} (asset unavailable)`
    const info = dataUrlInfo(src)
    const bytes = info?.bytes?.length || 0
    if (bytes > MAX_EMBED_BYTES || totalBytes + bytes > MAX_EMBED_BYTES * 3) {
      warnings.push(`"${asset.name}" is too large to embed in an exported file.`)
      return bang ? `[Image omitted: ${asset.name}]` : `${name} (asset too large to embed)`
    }
    totalBytes += bytes
    return bang ? `![${name}](${src})` : `[${name}](${src})`
  })
  return { markdown: output, warnings }
}

/** Import a .docx file to the draft's Markdown subset. */
export async function importDocx(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer) && !ArrayBuffer.isView(arrayBuffer)) {
    throw new Error('The Word file could not be read.')
  }
  const module = await import('mammoth')
  const mammoth = module.default || module
  if (!mammoth?.convertToHtml) throw new Error('Word import is unavailable in this browser.')
  // Mammoth's browser build reads `arrayBuffer`; its Node build reads `buffer`.
  // Supplying both keeps the helper testable without changing browser behaviour.
  const result = await mammoth.convertToHtml({ arrayBuffer, buffer: arrayBuffer }, {
    convertImage: mammoth.images.imgElement(async (image) => {
      const base64 = await image.read('base64')
      const type = String(image.contentType || '').toLowerCase()
      if (base64.length > MAX_EMBED_BYTES * 2 || !/^image\/(png|jpe?g|gif|webp|svg\+xml)/.test(type)) {
        return { src: '' }
      }
      return { src: `data:${type};base64,${base64}` }
    })
  })
  const warnings = (result.messages || [])
    .map((message) => String(message.message || '').trim())
    .filter(Boolean)
  return { markdown: collapseBlankLines(htmlToMarkdown(result.value || '')), warnings }
}

function imageType(mime) {
  if (/jpeg/i.test(mime)) return 'jpg'
  if (/png/i.test(mime)) return 'png'
  if (/gif/i.test(mime)) return 'gif'
  if (/bmp/i.test(mime)) return 'bmp'
  return ''
}

function imageDimensions(src) {
  const fallback = { width: 480, height: 320 }
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || !src.startsWith('data:image/')) {
      resolve(fallback)
      return
    }
    let settled = false
    const finish = (size) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(size)
    }
    const timer = setTimeout(() => finish(fallback), 1200)
    const image = new Image()
    image.onload = () => {
      const width = Math.max(80, Math.min(640, image.naturalWidth || 480))
      const ratio = (image.naturalHeight || 320) / Math.max(1, image.naturalWidth || 480)
      finish({ width, height: Math.max(60, Math.round(width * ratio)) })
    }
    image.onerror = () => finish(fallback)
    image.src = src
  })
}

function plainRunText(runs) {
  return runs.map((run) => {
    if (run.type === 'break') return '\n'
    return run.text || plainRunText(run.children || [])
  }).join('')
}

async function runsToDocx(runs, docx, warnings) {
  const children = []
  for (const run of runs) {
    if (run.type === 'text') {
      children.push(new docx.TextRun({ text: run.text }))
    } else if (run.type === 'strong') {
      children.push(new docx.TextRun({ text: plainRunText(run.children || []), bold: true }))
    } else if (run.type === 'em') {
      children.push(new docx.TextRun({ text: plainRunText(run.children || []), italics: true }))
    } else if (run.type === 'underline') {
      children.push(new docx.TextRun({ text: plainRunText(run.children || []), underline: {} }))
    } else if (run.type === 'strike') {
      children.push(new docx.TextRun({ text: plainRunText(run.children || []), strike: true }))
    } else if (run.type === 'code') {
      children.push(new docx.TextRun({ text: run.text, font: 'Courier New' }))
    } else if (run.type === 'sup') {
      children.push(new docx.TextRun({ text: plainRunText(run.children || []), superScript: true }))
    } else if (run.type === 'sub') {
      children.push(new docx.TextRun({ text: plainRunText(run.children || []), subScript: true }))
    } else if (run.type === 'break') {
      children.push(new docx.TextRun({ break: 1 }))
    } else if (run.type === 'link') {
      const href = sanitizeUrl(run.href)
      if (!href) {
        warnings.push(`A link to "${run.href}" was kept as plain text because the destination is not allowed.`)
        children.push(new docx.TextRun({ text: plainRunText(run.children || parseInline(run.text)) }))
      } else {
        children.push(new docx.ExternalHyperlink({
          link: href,
          children: [new docx.TextRun({ text: plainRunText(run.children || parseInline(run.text)), style: 'Hyperlink' })]
        }))
      }
    } else if (run.type === 'image') {
      try {
        let src = run.src
        let info = dataUrlInfo(src)
        if (info?.mime === 'image/svg+xml') {
          const svg = new TextDecoder().decode(info.bytes)
          const png = await svgToPngBlob(svg, { scale: 2 })
          src = await blobToDataURL(png)
          info = dataUrlInfo(src)
        }
        const type = imageType(info?.mime || '')
        if (!info || !type) throw new Error('unsupported image format')
        const { width, height } = await imageDimensions(src)
        children.push(new docx.ImageRun({
          data: info.bytes,
          type,
          transformation: { width, height },
          altText: { name: run.text || 'Figure', description: run.text || 'Inserted image' }
        }))
      } catch (error) {
        warnings.push(`An image (${run.text || 'without a label'}) could not be embedded in the Word file.`)
        children.push(new docx.TextRun({ text: `[Image: ${run.text || 'image'}]` }))
      }
    }
  }
  return children.length ? children : [new docx.TextRun({ text: '' })]
}

function headingLevel(level, docx) {
  const key = `HEADING_${Math.max(1, Math.min(9, level))}`
  return docx.HeadingLevel[key] || docx.HeadingLevel.HEADING_1
}

/**
 * Build a Word-compatible .docx Blob from the draft's Markdown.
 * @param {string} markdown
 * @param {{ title?: string, assets?: Array<any> }} [options]
 */
export async function buildDocxBlob(markdown, { title = '', assets = [] } = {}) {
  const prepared = resolveAssetReferences(markdown, assets)
  const module = await import('docx')
  const docx = module.default || module
  const blocks = parseMarkdown(prepared.markdown)
  const children = []

  for (const block of blocks) {
    if (block.type === 'rule') {
      children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '────────────────────' })] }))
    } else if (block.type === 'heading') {
      children.push(new docx.Paragraph({
        heading: headingLevel(block.level, docx),
        children: await runsToDocx(parseInline(block.text), docx, prepared.warnings)
      }))
    } else if (block.type === 'list') {
      for (const [index, item] of block.items.entries()) {
        const prefix = block.ordered ? `${index + 1}. ` : ''
        const runs = await runsToDocx(parseInline(item), docx, prepared.warnings)
        children.push(new docx.Paragraph({
          children: prefix ? [new docx.TextRun({ text: prefix }), ...runs] : runs,
          bullet: block.ordered ? undefined : { level: 0 }
        }))
      }
    } else if (block.type === 'quote') {
      children.push(new docx.Paragraph({
        indent: { left: 720 },
        children: await runsToDocx(parseInline(block.text), docx, prepared.warnings)
      }))
    } else if (block.type === 'code') {
      for (const line of String(block.text || '').split('\n')) {
        children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: line, font: 'Courier New', size: 20 })] }))
      }
    } else if (block.type === 'table') {
      const rows = []
      for (const row of block.rows) {
        const cells = []
        for (const cell of row) {
          cells.push(new docx.TableCell({
            children: [new docx.Paragraph({
              children: await runsToDocx(parseInline(cell), docx, prepared.warnings)
            })]
          }))
        }
        rows.push(new docx.TableRow({ children: cells }))
      }
      children.push(new docx.Table({ rows }))
      children.push(new docx.Paragraph({ children: [] }))
    } else {
      children.push(new docx.Paragraph({
        spacing: { after: 160 },
        children: await runsToDocx(parseInline(block.text), docx, prepared.warnings)
      }))
    }
  }

  const document = new docx.Document({
    creator: 'SciVeyra',
    title: title || 'SciVeyra draft',
    description: 'Local-first draft exported from SciVeyra',
    sections: [{ children }]
  })
  return { blob: await docx.Packer.toBlob(document), warnings: prepared.warnings }
}

export function markdownExport(markdown, assets = []) {
  const prepared = resolveAssetReferences(markdown, assets)
  return { text: collapseBlankLines(prepared.markdown), warnings: prepared.warnings }
}

export function textExport(markdown, assets = []) {
  const prepared = resolveAssetReferences(markdown, assets)
  return {
    text: markdownToPlainText(prepared.markdown)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Image: $1]')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)'),
    warnings: prepared.warnings
  }
}
