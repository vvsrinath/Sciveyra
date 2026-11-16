import { buildDataset } from './parse.js'

const NOTE = 'Synthetic sample data for demonstration and testing only. These are not experimental measurements.'

function deterministicNoise(index, seed = 1) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453
  return value - Math.floor(value)
}

export function sampleEngineDataset() {
  const rows = []
  for (let load = 0; load <= 100; load += 5) {
    const efficiency = 8 + 0.55 * load - 0.0028 * load ** 2 + (deterministicNoise(load, 2) - 0.5) * 1.1
    const torque = 45 + 0.32 * load + (deterministicNoise(load, 7) - 0.5) * 1.4
    const error = 0.35 + deterministicNoise(load, 3) * 0.45
    rows.push([load, Number(efficiency.toFixed(3)), Number(torque.toFixed(3)), Number(error.toFixed(3))])
  }
  const dataset = buildDataset({
    name: 'Synthetic engine performance (sample)',
    headers: ['Engine load (%)', 'Brake thermal efficiency (%)', 'Torque (N·m)', 'Efficiency error (±%)'],
    rows,
    source: 'sample'
  })
  dataset.id = 'sample_engine'
  dataset.warnings = [NOTE]
  return dataset
}

export function sampleSpectrumDataset() {
  const rows = []
  const peaks = [
    { position: 21.4, height: 100, width: 0.18 },
    { position: 27.3, height: 44, width: 0.24 },
    { position: 35.9, height: 67, width: 0.3 },
    { position: 43.1, height: 29, width: 0.2 },
    { position: 56.7, height: 52, width: 0.35 },
    { position: 68.2, height: 18, width: 0.28 }
  ]
  for (let angle = 10; angle <= 80; angle += 0.1) {
    let intensity = 4 + deterministicNoise(angle, 11) * 2.2
    for (const peak of peaks) {
      intensity += peak.height * Math.exp(-((angle - peak.position) ** 2) / (2 * peak.width ** 2))
    }
    rows.push([Number(angle.toFixed(2)), Number(intensity.toFixed(3))])
  }
  const dataset = buildDataset({
    name: 'Synthetic XRD pattern (sample)',
    headers: ['2 Theta (degrees)', 'Intensity (a.u.)'],
    rows,
    source: 'sample'
  })
  dataset.id = 'sample_spectrum'
  dataset.warnings = [NOTE]
  return dataset
}

export function sampleSurfaceDataset() {
  const rows = []
  for (let y = 0; y <= 10; y += 1) {
    for (let x = 0; x <= 10; x += 1) {
      const z = Math.sin(x / 2) * Math.cos(y / 2.5) + 0.25 * Math.sin((x + y) / 1.5)
      rows.push([x, y, Number(z.toFixed(4))])
    }
  }
  const dataset = buildDataset({
    name: 'Synthetic surface grid (sample)',
    headers: ['X', 'Y', 'Z'],
    rows,
    source: 'sample'
  })
  dataset.id = 'sample_surface'
  dataset.warnings = [NOTE]
  return dataset
}

export function sampleGroupedDataset() {
  const rows = []
  const groups = ['Control', 'Treatment A', 'Treatment B']
  groups.forEach((group, groupIndex) => {
    for (let index = 0; index < 12; index += 1) {
      const base = [24, 31, 28][groupIndex]
      const value = base + Math.sin(index * 1.7 + groupIndex) * 2 + (deterministicNoise(index, groupIndex + 5) - 0.5) * 1.5
      rows.push([group, index + 1, Number(value.toFixed(3))])
    }
  })
  const dataset = buildDataset({
    name: 'Synthetic grouped observations (sample)',
    headers: ['Group', 'Replicate', 'Response (units)'],
    rows,
    source: 'sample'
  })
  dataset.rows = dataset.rows.map((row) => ({ ...row, c1: row.c1 }))
  dataset.id = 'sample_grouped'
  dataset.warnings = [NOTE]
  return dataset
}

export function sampleDatasets() {
  return [sampleEngineDataset(), sampleSpectrumDataset(), sampleSurfaceDataset(), sampleGroupedDataset()]
}
