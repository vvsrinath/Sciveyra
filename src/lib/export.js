import { csvEscape, slugify } from './util.js'
import { datasetToCSV } from './parse.js'

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

export function downloadJSON(value, filename) {
  downloadText(JSON.stringify(value, null, 2), filename, 'application/json')
}

export function downloadDatasetCSV(dataset, filename) {
  downloadText(datasetToCSV(dataset), filename || `${slugify(dataset?.name || 'dataset')}.csv`, 'text/csv;charset=utf-8')
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('The file could not be read.'))
    reader.readAsText(file)
  })
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('The file could not be read.'))
    reader.readAsDataURL(file)
  })
}

export function csvFromRows(rows, headers) {
  return [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')
}

const ALLOWED_SVG_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath',
  'mask', 'pattern', 'symbol', 'use', 'title', 'desc', 'marker', 'filter',
  'feblend', 'fecolormatrix', 'fegaussianblur', 'feoffset', 'femerge', 'femergenode',
  'image', 'style'
])

const ALLOWED_ATTRS = new Set([
  'xmlns', 'xmlns:xlink', 'viewbox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-opacity', 'opacity', 'font-family', 'font-size', 'font-weight',
  'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'class', 'id',
  'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end', 'offset', 'stop-color',
  'stop-opacity', 'gradientunits', 'gradienttransform', 'patternunits', 'preserveaspectratio',
  'href', 'xlink:href', 'role', 'aria-label', 'version', 'xml:space'
])

export function sanitizeSvg(svgText) {
  if (typeof svgText !== 'string' || !svgText.trim()) throw new Error('SVG content is empty.')
  if (typeof DOMParser === 'undefined') throw new Error('SVG validation requires a browser environment.')
  if (svgText.length > 8_000_000) throw new Error('SVG is too large to import safely.')
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const error = doc.querySelector('parsererror')
  if (error) throw new Error('The SVG file could not be parsed. Check that it is valid XML.')
  const root = doc.documentElement
  if (!root || root.nodeName.toLowerCase() !== 'svg') throw new Error('The file does not contain a root <svg> element.')

  const walk = (node) => {
    if (node.nodeType === 1) {
      const tag = node.nodeName.toLowerCase()
      if (tag === 'script' || tag === 'foreignobject') {
        node.remove()
        return
      }
      if (!ALLOWED_SVG_TAGS.has(tag)) {
        node.remove()
        return
      }
      for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase()
        const value = String(attribute.value || '')
        const unsafeValue = /javascript:|data:text\/html|<script|on\w+\s*=/i.test(value)
        if (!ALLOWED_ATTRS.has(name) || name.startsWith('on') || unsafeValue) {
          node.removeAttribute(attribute.name)
        }
      }
      if (tag === 'image') {
        const href = node.getAttribute('href') || node.getAttribute('xlink:href') || ''
        if (!/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(href)) node.remove()
      }
    }
    for (const child of [...(node.childNodes || [])]) walk(child)
  }
  walk(root)
  const output = new XMLSerializer().serializeToString(root)
  if (!output.toLowerCase().includes('<svg')) throw new Error('The SVG was empty after safety validation.')
  return output
}

export function svgDimensions(svgText) {
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
    const root = doc.documentElement
    const viewBox = root.getAttribute('viewBox')
    if (viewBox) {
      const [, , width, height] = viewBox.split(/\s+/).map(Number)
      if (width > 0 && height > 0) return { width, height }
    }
    const width = Number.parseFloat(root.getAttribute('width') || '')
    const height = Number.parseFloat(root.getAttribute('height') || '')
    if (width > 0 && height > 0) return { width, height }
  } catch {
    /* ignore */
  }
  return { width: 800, height: 600 }
}

/**
 * @param {string} svgText
 * @param {{width?: number, height?: number, scale?: number, background?: string}} [options]
 * @returns {Promise<Blob>}
 */
export async function svgToPngBlob(svgText, { width, height, scale = 2, background = '#ffffff' } = {}) {
  const clean = sanitizeSvg(svgText)
  const size = svgDimensions(clean)
  const w = Math.max(1, Math.round((width || size.width) * scale))
  const h = Math.max(1, Math.round((height || size.height) * scale))
  if (w * h > 80_000_000) throw new Error('Requested PNG resolution is too large. Reduce the scale or dimensions.')
  const blob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available in this browser.')
    context.fillStyle = background
    context.fillRect(0, 0, w, h)
    context.drawImage(image, 0, 0, w, h)
    return await canvasToBlob(canvas, 'image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The image could not be decoded.'))
    image.src = src
  })
}

export function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The browser could not encode this image.'))
    }, type, quality)
  })
}

export async function pngBlobToPdf(pngBlob, filename, { width, height } = {}) {
  const { jsPDF } = await import('jspdf')
  const dataUrl = await blobToDataURL(pngBlob)
  const size = width && height ? { width, height } : await blobImageSize(pngBlob)
  const pdf = new jsPDF({ orientation: size.width >= size.height ? 'landscape' : 'portrait', unit: 'px', format: [size.width, size.height], hotfixes: ['px_scaling'] })
  pdf.addImage(dataUrl, 'PNG', 0, 0, size.width, size.height)
  pdf.save(filename)
}

/**
 * @param {string} svgText
 * @param {string} filename
 * @param {{width?: number, height?: number, scale?: number, background?: string}} [options]
 */
export async function svgToPdf(svgText, filename, options = {}) {
  const size = svgDimensions(svgText)
  const png = await svgToPngBlob(svgText, { ...options, width: options.width || size.width, height: options.height || size.height })
  await pngBlobToPdf(png, filename, { width: options.width || size.width, height: options.height || size.height })
}

/**
 * @param {any} Plotly
 * @param {any} graphDiv
 * @param {'png'|'svg'|'pdf'} format
 * @param {string} filename
 * @param {{width?: number, height?: number, scale?: number, background?: string}} [options]
 */
export async function exportPlotly(Plotly, graphDiv, format, filename, { width, height, scale = 2, background = '#ffffff' } = {}) {
  if (!Plotly || !graphDiv) throw new Error('The chart is not ready yet.')
  if (format === 'svg') {
    const dataUrl = await Plotly.toImage(graphDiv, { format: 'svg', width, height })
    const svg = decodeURIComponent(dataUrl.split(',').slice(1).join(','))
    downloadText(sanitizeSvg(svg), filename, 'image/svg+xml;charset=utf-8')
    return
  }
  if (format === 'png') {
    const dataUrl = await Plotly.toImage(graphDiv, { format: 'png', width, height, scale, imageDataOnly: false })
    const blob = dataURLToBlob(dataUrl)
    downloadBlob(blob, filename)
    return
  }
  if (format === 'pdf') {
    const dataUrl = await Plotly.toImage(graphDiv, { format: 'png', width, height, scale })
    const blob = dataURLToBlob(dataUrl)
    await pngBlobToPdf(blob, filename, { width: width || 900, height: height || 560 })
    return
  }
  throw new Error(`Unsupported export format: ${format}`)
}

/**
 * Render a graph (dataset + config) to a sanitised SVG string using an
 * offscreen Plotly div. Used by the Figure Composer to snapshot live panels.
 * @param {{ data: any[]; layout: any }} figure
 * @param {{ width: number; height: number; background?: string }} options
 * @returns {Promise<string>}
 */
export async function renderGraphToSvg(figure, options = {}) {
  const Plotly = await import('plotly.js-dist-min')
  const width = Math.max(80, Math.round(options.width || 900))
  const height = Math.max(80, Math.round(options.height || 560))
  const div = document.createElement('div')
  div.style.position = 'fixed'
  div.style.left = '-10000px'
  div.style.top = '0'
  div.style.width = `${width}px`
  div.style.height = `${height}px`
  div.style.background = options.background || '#ffffff'
  document.body.appendChild(div)
  try {
    const layout = { ...(figure.layout || {}), width, height, autosize: false }
    await Plotly.newPlot(div, figure.data || [], layout, { staticPlot: true, displayModeBar: false })
    const dataUrl = await Plotly.toImage(div, { format: 'svg', width, height })
    const svg = decodeURIComponent(dataUrl.split(',').slice(1).join(','))
    return sanitizeSvg(svg)
  } finally {
    try { Plotly.purge(div) } catch { /* ignore */ }
    div.remove()
  }
}

export function dataURLToBlob(dataUrl) {
  const [header, base64] = String(dataUrl).split(',')
  const mime = (header.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mime })
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('The file could not be read.'))
    reader.readAsDataURL(blob)
  })
}

function blobImageSize(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      resolve({ width: image.naturalWidth || 900, height: image.naturalHeight || 560 })
      URL.revokeObjectURL(url)
    }
    image.onerror = () => {
      resolve({ width: 900, height: 560 })
      URL.revokeObjectURL(url)
    }
    image.src = url
  })
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}
