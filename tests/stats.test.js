import { describe, expect, it } from 'vitest'
import {
  boxStats, describe as describeStats, histogram, linearInterpolate,
  linearRegression, mean, meanConfidenceInterval95, median, pearson,
  percentile, polynomialRegression, spearman, standardDeviation
} from '../src/lib/stats.js'

describe('descriptive statistics', () => {
  it('computes mean/median/percentiles while ignoring invalid values', () => {
    expect(mean([1, 2, 3, 4, 'x', null, Infinity])).toBe(2.5)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(percentile([0, 10], 0.25)).toBe(2.5)
    expect(mean([])).toBeNull()
    expect(median([])).toBeNull()
  })

  it('reports sample and population standard deviation', () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9], false)).toBeCloseTo(2, 8)
    expect(standardDeviation([1], true)).toBeNull()
  })

  it('describes a series with spread and missing count', () => {
    const result = describeStats([1, 2, 3, 4, null])
    expect(result.n).toBe(4)
    expect(result.missing).toBe(1)
    expect(result.min).toBe(1)
    expect(result.max).toBe(4)
    expect(result.range).toBe(3)
    expect(result.q1).toBeCloseTo(1.75, 8)
    expect(result.q3).toBeCloseTo(3.25, 8)
    expect(result.sem).toBeGreaterThan(0)
  })

  it('returns a null-filled summary for empty input', () => {
    const result = describeStats([])
    expect(result.n).toBe(0)
    expect(result.mean).toBeNull()
  })

  it('computes confidence intervals and box statistics', () => {
    const ci = meanConfidenceInterval95([10, 12, 13, 15, 14])
    expect(ci.lower).toBeLessThan(ci.mean)
    expect(ci.upper).toBeGreaterThan(ci.mean)
    const box = boxStats([1, 2, 3, 4, 100])
    expect(box.median).toBe(3)
    expect(box.outliers).toEqual([100])
  })
})

describe('correlation and regression', () => {
  const xs = [1, 2, 3, 4, 5]
  const ys = [2, 4, 6, 8, 10]

  it('computes perfect Pearson and Spearman correlation', () => {
    expect(pearson(xs, ys)).toBeCloseTo(1, 10)
    expect(spearman(xs, ys)).toBeCloseTo(1, 10)
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull()
  })

  it('fits a linear regression with an exact line', () => {
    const fit = linearRegression(xs, ys)
    expect(fit.slope).toBeCloseTo(2, 10)
    expect(fit.intercept).toBeCloseTo(0, 10)
    expect(fit.r2).toBeCloseTo(1, 10)
    expect(fit.predict(6)).toBeCloseTo(12, 10)
    expect(fit.error).toBeUndefined()
  })

  it('reports regression errors for insufficient or degenerate data', () => {
    expect(linearRegression([1], [2]).error).toMatch(/at least 2/)
    expect(linearRegression([1, 1], [2, 3]).error).toMatch(/identical/)
  })

  it('fits a quadratic polynomial', () => {
    const fit = polynomialRegression([-2, -1, 0, 1, 2], [4, 1, 0, 1, 4], 2)
    expect(fit.error).toBeUndefined()
    expect(fit.predict(3)).toBeCloseTo(9, 6)
  })
})

describe('binnings and interpolation', () => {
  it('bins all values into a histogram', () => {
    const result = histogram([1, 2, 2, 3, 4, 5], 3)
    expect(result.bins).toHaveLength(3)
    expect(result.bins.reduce((total, bin) => total + bin.count, 0)).toBe(6)
  })

  it('interpolates inside the data range only', () => {
    expect(linearInterpolate([0, 10], [0, 100], 2.5).y).toBeCloseTo(25, 8)
    expect(linearInterpolate([0, 10], [0, 100], 11).error).toMatch(/outside/)
    expect(linearInterpolate([0], [0], 0).error).toMatch(/at least 2/)
  })
})
