import { describe, expect, it } from 'vitest'
import {
  fitAllModels, grubbsOutliers, grubbsTest, iqrOutliers, movingAverage,
  nonlinearFit, normalizeColumn, numericalDerivative, ratioColumns
} from '../src/lib/stats.js'

function sample(id, params, xs) {
  const fns = {
    exponential: (p, x) => p[0] * Math.exp(p[1] * x),
    logarithmic: (p, x) => p[0] + p[1] * Math.log(x),
    power: (p, x) => p[0] * x ** p[1],
    gaussian: (p, x) => p[0] * Math.exp(-((x - p[1]) ** 2) / (2 * p[2] ** 2)),
    lorentzian: (p, x) => p[0] * (p[2] ** 2) / ((x - p[1]) ** 2 + p[2] ** 2)
  }
  return xs.map((x) => fns[id](params, x))
}

describe('nonlinearFit', () => {
  it('fits an exponential model accurately', () => {
    const xs = [0, 1, 2, 3, 4, 5]
    const ys = sample('exponential', [2, 0.5], xs)
    const fit = nonlinearFit('exponential', xs, ys)
    expect(fit.error).toBeUndefined()
    expect(fit.parameters[0]).toBeCloseTo(2, 3)
    expect(fit.parameters[1]).toBeCloseTo(0.5, 3)
    expect(fit.r2).toBeCloseTo(1, 6)
    expect(fit.predict(6)).toBeCloseTo(2 * Math.exp(3), 3)
  })

  it('fits a gaussian peak accurately', () => {
    const xs = []
    for (let x = -5; x <= 5; x += 0.25) xs.push(x)
    const ys = sample('gaussian', [10, 1.5, 0.8], xs)
    const fit = nonlinearFit('gaussian', xs, ys)
    expect(fit.error).toBeUndefined()
    expect(fit.parameters[0]).toBeCloseTo(10, 2)
    expect(fit.parameters[1]).toBeCloseTo(1.5, 2)
    expect(fit.parameters[2]).toBeCloseTo(0.8, 2)
    expect(fit.r2).toBeGreaterThan(0.999)
  })

  it('fits a power-law model', () => {
    const xs = [1, 2, 3, 4, 5, 6]
    const ys = sample('power', [3, 1.5], xs)
    const fit = nonlinearFit('power', xs, ys)
    expect(fit.error).toBeUndefined()
    expect(fit.parameters[0]).toBeCloseTo(3, 2)
    expect(fit.parameters[1]).toBeCloseTo(1.5, 2)
  })

  it('reports errors for invalid domains and too few points', () => {
    expect(nonlinearFit('logarithmic', [-1, 0, 1], [1, 2, 3]).error).toMatch(/positive X/)
    expect(nonlinearFit('power', [0, 1, 2], [1, 2, 3]).error).toMatch(/positive X/)
    expect(nonlinearFit('gaussian', [1, 2], [1, 2]).error).toMatch(/at least/)
    expect(nonlinearFit('does-not-exist', [1, 2, 3], [1, 2, 3]).error).toMatch(/Unknown/)
  })

  it('fits a Lorentzian peak', () => {
    const xs = []
    for (let x = 0; x <= 20; x += 0.5) xs.push(x)
    const ys = sample('lorentzian', [8, 10, 1.2], xs)
    const fit = nonlinearFit('lorentzian', xs, ys)
    expect(fit.error).toBeUndefined()
    expect(fit.parameters[1]).toBeCloseTo(10, 1)
    expect(fit.r2).toBeGreaterThan(0.999)
  })

  it('ranks all models by adjusted R squared', () => {
    const xs = [0, 1, 2, 3, 4, 5]
    const ys = sample('exponential', [2, 0.5], xs)
    const ranked = fitAllModels(xs, ys)
    expect(ranked.length).toBeGreaterThan(2)
    expect(ranked[0].model).toBe('exponential')
  })
})

describe('outlier detection', () => {
  it('flags a single extreme value with Grubbs', () => {
    const result = grubbsTest([1, 2, 2, 2, 3, 3, 100])
    expect(result.isOutlier).toBe(true)
    expect(result.value).toBe(100)
    expect(result.statistic).toBeGreaterThan(result.critical)
  })

  it('reports no outlier for tightly clustered data', () => {
    expect(grubbsTest([5, 5.1, 4.9, 5.05, 5.02]).isOutlier).toBe(false)
  })

  it('needs at least three points', () => {
    expect(grubbsTest([1, 2]).error).toMatch(/at least 3/)
    expect(grubbsTest([1, 1, 1, 1]).error).toMatch(/identical/)
  })

  it('iteratively removes multiple Grubbs outliers', () => {
    const result = grubbsOutliers([1, 1, 2, 2, 3, 100, 200])
    expect(result.removedCount).toBeGreaterThanOrEqual(1)
    expect(result.removed.map((entry) => entry.value)).toContain(200)
    expect(result.remaining.every((value) => value < 100)).toBe(true)
  })

  it('flags IQR outliers with bounds', () => {
    const result = iqrOutliers([1, 2, 3, 4, 5, 100])
    expect(result.indices).toContain(5)
    expect(result.values).toContain(100)
    expect(result.upper).toBeLessThan(100)
  })
})

describe('column math', () => {
  it('smooths with a moving average preserving length and gaps', () => {
    const result = movingAverage([1, 2, 3, 4, 5], 3)
    expect(result).toHaveLength(5)
    expect(result[2]).toBeCloseTo(3, 6)
    expect(movingAverage([1, null, 3], 1)[1]).toBeNull()
  })

  it('normalizes with min-max and z-score', () => {
    expect(normalizeColumn([0, 5, 10], 'minmax')).toEqual([0, 0.5, 1])
    const z = normalizeColumn([2, 4, 6], 'zscore')
    expect(z[0]).toBeCloseTo(-1, 6)
    expect(z[1]).toBeCloseTo(0, 6)
    expect(z[2]).toBeCloseTo(1, 6)
  })

  it('computes ratios guarding division by zero', () => {
    expect(ratioColumns([10, 20, 30], [2, 0, 5])).toEqual([5, null, 6])
  })

  it('computes a numerical derivative', () => {
    const result = numericalDerivative([0, 1, 2, 3], [0, 1, 4, 9])
    expect(result[0].dydx).toBeCloseTo(1, 6)
    expect(result[1].dydx).toBeCloseTo(2, 6)
    expect(result[2].dydx).toBeCloseTo(4, 6)
    expect(result[3].dydx).toBeCloseTo(5, 6)
  })
})
