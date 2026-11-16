import { sanitizeSvg } from './export.js'

export const TRACE_PRESETS = {
  'Line art': { numberofcolors: 2, ltres: 1, qtres: 1, pathomit: 8, blurradius: 0, strokewidth: 0.5 },
  'Simple logo': { numberofcolors: 8, ltres: 1.2, qtres: 1.2, pathomit: 12, blurradius: 1, strokewidth: 1 },
  'Posterized': { numberofcolors: 16, ltres: 2, qtres: 2, pathomit: 16, blurradius: 2, strokewidth: 1 },
  'Detailed': { numberofcolors: 32, ltres: 0.8, qtres: 0.8, pathomit: 4, blurradius: 0, strokewidth: 0.5 }
}

export async function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The image could not be opened.'))
    image.src = src
  })
}

export async function traceImageToSvg(src, {
  preset = 'Line art',
  threshold = 145,
  maxDimension = 1400,
  mode = 'color',
  simplify = true
} = {}) {
  const image = await loadImageElement(src)
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is not available in this browser.')
  context.drawImage(image, 0, 0, width, height)
  const imageData = context.getImageData(0, 0, width, height)

  if (mode === 'threshold') {
    const data = imageData.data
    for (let index = 0; index < data.length; index += 4) {
      const luminance = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]
      const value = luminance < threshold ? 0 : 255
      data[index] = value
      data[index + 1] = value
      data[index + 2] = value
      data[index + 3] = 255
    }
  }

  const module = await import('imagetracerjs')
  const ImageTracer = module.default || module
  const base = TRACE_PRESETS[preset] || TRACE_PRESETS['Line art']
  const options = {
    ...base,
    ...(mode === 'threshold' ? { numberofcolors: 2 } : {}),
    ltres: simplify ? Math.max(base.ltres, 1.2) : base.ltres,
    qtres: simplify ? Math.max(base.qtres, 1.2) : base.qtres,
    scale: 1,
    viewbox: true
  }
  const svg = ImageTracer.imagedataToSVG(imageData, options)
  if (!svg || typeof svg !== 'string') throw new Error('The tracing engine did not return SVG output.')
  const clean = sanitizeSvg(svg)
  return { svg: clean, width, height, colors: options.numberofcolors }
}

export function estimateTraceTime(width, height, colors) {
  const pixels = width * height
  const factor = pixels / 500000 * (colors / 8)
  if (factor < 1) return 'a few seconds'
  if (factor < 4) return '5–15 seconds'
  return '15–60 seconds'
}
