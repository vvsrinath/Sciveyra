import { describe, expect, it } from 'vitest'
import {
  sampleDatasets, sampleEngineDataset, sampleGroupedDataset,
  sampleSpectrumDataset, sampleSurfaceDataset
} from '../src/lib/sampleData.js'

describe('synthetic sample datasets', () => {
  it('uses stable ids so repeated seeding cannot create duplicates', () => {
    expect(sampleEngineDataset().id).toBe('sample_engine')
    expect(sampleSpectrumDataset().id).toBe('sample_spectrum')
    expect(sampleSurfaceDataset().id).toBe('sample_surface')
    expect(sampleGroupedDataset().id).toBe('sample_grouped')
    expect(sampleEngineDataset().id).toBe(sampleEngineDataset().id)
  })

  it('labels every dataset as synthetic sample data', () => {
    for (const dataset of sampleDatasets()) {
      expect(dataset.source).toBe('sample')
      expect(dataset.warnings.join(' ')).toMatch(/[Ss]ynthetic sample data/)
      expect(dataset.rows.length).toBeGreaterThan(0)
    }
  })

  it('produces numeric columns suitable for plotting and analysis', () => {
    const engine = sampleEngineDataset()
    expect(engine.columns.map((column) => column.type)).toEqual(['numeric', 'numeric', 'numeric', 'numeric'])
    expect(engine.rowCount).toBe(21)
    const surface = sampleSurfaceDataset()
    expect(surface.rowCount).toBe(121)
  })
})
