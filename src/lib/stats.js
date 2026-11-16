export function cleanNumbers(values) {
  return (values || []).filter((value) => typeof value === 'number' && Number.isFinite(value))
}

export function sum(values) {
  return cleanNumbers(values).reduce((total, value) => total + value, 0)
}

export function mean(values) {
  const data = cleanNumbers(values)
  return data.length ? sum(data) / data.length : null
}

export function median(values) {
  const data = cleanNumbers(values).sort((a, b) => a - b)
  return percentileSorted(data, 0.5)
}

export function percentile(values, fraction) {
  const data = cleanNumbers(values).sort((a, b) => a - b)
  return percentileSorted(data, fraction)
}

function percentileSorted(sorted, fraction) {
  if (!sorted.length) return null
  if (sorted.length === 1) return sorted[0]
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

export function variance(values, sample = true) {
  const data = cleanNumbers(values)
  if (data.length < (sample ? 2 : 1)) return null
  const average = mean(data)
  const total = data.reduce((acc, value) => acc + (value - average) ** 2, 0)
  return total / (data.length - (sample ? 1 : 0))
}

export function standardDeviation(values, sample = true) {
  const v = variance(values, sample)
  return v === null ? null : Math.sqrt(v)
}

export function describe(values) {
  const input = values || []
  const data = cleanNumbers(input).sort((a, b) => a - b)
  const n = data.length
  if (!n) {
    return {
      n: 0, missing: input.length, mean: null, median: null, sd: null, variance: null,
      min: null, max: null, range: null, q1: null, q3: null, iqr: null, sum: null,
      sem: null, cv: null
    }
  }
  const meanValue = mean(data)
  const sd = standardDeviation(data)
  const q1 = percentileSorted(data, 0.25)
  const q3 = percentileSorted(data, 0.75)
  return {
    n,
    missing: input.length - n,
    mean: meanValue,
    median: percentileSorted(data, 0.5),
    sd,
    variance: variance(data),
    min: data[0],
    max: data[n - 1],
    range: data[n - 1] - data[0],
    q1,
    q3,
    iqr: q3 - q1,
    sum: sum(data),
    sem: n > 1 ? sd / Math.sqrt(n) : null,
    cv: meanValue ? sd / Math.abs(meanValue) : null
  }
}

/**
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {number|null}
 */
export function pearson(xs, ys) {
  const pairs = pairedClean(xs, ys)
  const n = pairs.length
  if (n < 2) return null
  const mx = mean(pairs.map((pair) => pair[0]))
  const my = mean(pairs.map((pair) => pair[1]))
  let numerator = 0
  let dx = 0
  let dy = 0
  for (const [x, y] of pairs) {
    numerator += (x - mx) * (y - my)
    dx += (x - mx) ** 2
    dy += (y - my) ** 2
  }
  if (dx === 0 || dy === 0) return null
  return numerator / Math.sqrt(dx * dy)
}

export function spearman(xs, ys) {
  const pairs = pairedClean(xs, ys)
  if (pairs.length < 2) return null
  return pearson(rank(pairs.map((pair) => pair[0])), rank(pairs.map((pair) => pair[1])))
}

function rank(values) {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const ranks = new Array(values.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) j += 1
    const averageRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k += 1) ranks[indexed[k].index] = averageRank
    i = j + 1
  }
  return ranks
}

function pairedClean(xs, ys) {
  const pairs = []
  const length = Math.min(xs?.length || 0, ys?.length || 0)
  for (let index = 0; index < length; index += 1) {
    const x = xs[index]
    const y = ys[index]
    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
      pairs.push([x, y])
    }
  }
  return pairs
}

/**
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {any}
 */
export function linearRegression(xs, ys) {
  const pairs = pairedClean(xs, ys)
  const n = pairs.length
  if (n < 2) {
    return { error: 'Linear regression needs at least 2 complete (x, y) pairs.', n }
  }
  const mx = mean(pairs.map((pair) => pair[0]))
  const my = mean(pairs.map((pair) => pair[1]))
  let sxx = 0
  let sxy = 0
  for (const [x, y] of pairs) {
    sxx += (x - mx) ** 2
    sxy += (x - mx) * (y - my)
  }
  if (sxx === 0) return { error: 'All X values are identical; a slope cannot be estimated.', n }
  const slope = sxy / sxx
  const intercept = my - slope * mx
  const fitted = pairs.map(([x]) => slope * x + intercept)
  const residuals = pairs.map(([, y], index) => y - fitted[index])
  const ssRes = residuals.reduce((acc, value) => acc + value ** 2, 0)
  const ssTot = pairs.reduce((acc, [, y]) => acc + (y - my) ** 2, 0)
  const r2 = ssTot === 0 ? null : 1 - ssRes / ssTot
  const r = ssTot === 0 ? null : Math.sign(slope) * Math.sqrt(Math.max(0, r2))
  const df = n - 2
  const residualVariance = df > 0 ? ssRes / df : null
  const slopeStdErr = residualVariance !== null && sxx > 0 ? Math.sqrt(residualVariance / sxx) : null
  const interceptStdErr = residualVariance !== null
    ? Math.sqrt(residualVariance * (1 / n + (mx ** 2) / sxx))
    : null
  return {
    n,
    slope,
    intercept,
    r,
    r2,
    df,
    ssRes,
    ssTot,
    residuals,
    fitted,
    x: pairs.map((pair) => pair[0]),
    y: pairs.map((pair) => pair[1]),
    slopeStdErr,
    interceptStdErr,
    equation: `y = ${formatCoefficient(slope)}x ${intercept >= 0 ? '+' : '−'} ${formatCoefficient(Math.abs(intercept))}`,
    predict: (x) => slope * x + intercept
  }
}

/**
 * @param {number[]} xs
 * @param {number[]} ys
 * @param {number} [degree]
 * @returns {any}
 */
export function polynomialRegression(xs, ys, degree = 2) {
  const pairs = pairedClean(xs, ys)
  const n = pairs.length
  const d = Math.round(degree)
  if (!Number.isInteger(d) || d < 1 || d > 8) return { error: 'Polynomial degree must be an integer from 1 to 8.' }
  if (n < d + 2) return { error: `Degree ${d} needs at least ${d + 2} complete (x, y) pairs.` }
  const xValues = pairs.map((pair) => pair[0])
  const center = mean(xValues)
  const scale = Math.sqrt(variance(xValues, false)) || 1
  if (!scale || !Number.isFinite(scale)) return { error: 'X values do not have enough spread to fit a polynomial.' }
  const z = xValues.map((x) => (x - center) / scale)
  const size = d + 1
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0))
  const vector = new Array(size).fill(0)
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      matrix[row][col] = z.reduce((acc, value) => acc + value ** (row + col), 0)
    }
    vector[row] = pairs.reduce((acc, [, y], index) => acc + y * z[index] ** row, 0)
  }
  const solution = solveLinearSystem(matrix, vector)
  if (!solution) return { error: 'The polynomial fit could not be solved; the X values may be poorly conditioned.' }
  const predictZ = (value) => solution.reduce((acc, coefficient, power) => acc + coefficient * value ** power, 0)
  const fitted = z.map((value) => predictZ(value))
  const residuals = pairs.map(([, y], index) => y - fitted[index])
  const ssRes = residuals.reduce((acc, value) => acc + value ** 2, 0)
  const my = mean(pairs.map((pair) => pair[1]))
  const ssTot = pairs.reduce((acc, [, y]) => acc + (y - my) ** 2, 0)
  const r2 = ssTot === 0 ? null : 1 - ssRes / ssTot
  const coefficients = convertNormalizedCoefficients(solution, center, scale)
  return {
    n,
    degree: d,
    coefficients,
    normalizedCoefficients: solution,
    center,
    scale,
    r2,
    ssRes,
    ssTot,
    residuals,
    fitted,
    x: xValues,
    y: pairs.map((pair) => pair[1]),
    equation: polynomialEquation(coefficients),
    predict: (x) => coefficients.reduce((acc, coefficient, power) => acc + coefficient * x ** power, 0)
  }
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length
  const a = matrix.map((row, index) => [...row, vector[index]])
  for (let column = 0; column < n; column += 1) {
    let pivot = column
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row
    }
    if (Math.abs(a[pivot][column]) < 1e-12) return null
    ;[a[column], a[pivot]] = [a[pivot], a[column]]
    const pivotValue = a[column][column]
    for (let col = column; col <= n; col += 1) a[column][col] /= pivotValue
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue
      const factor = a[row][column]
      if (factor === 0) continue
      for (let col = column; col <= n; col += 1) a[row][col] -= factor * a[column][col]
    }
  }
  return a.map((row) => row[n])
}

function convertNormalizedCoefficients(normalized, center, scale) {
  const degree = normalized.length - 1
  const output = new Array(normalized.length).fill(0)
  for (let k = 0; k <= degree; k += 1) {
    for (let j = 0; j <= k; j += 1) {
      const coefficient = normalized[k] * binomial(k, j) * ((-center) / scale) ** (k - j) * (1 / scale) ** j
      output[j] += coefficient
    }
  }
  return output
}

function binomial(n, k) {
  let result = 1
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i
  return result
}

export function polynomialEquation(coefficients) {
  const parts = []
  for (let power = coefficients.length - 1; power >= 0; power -= 1) {
    const coefficient = coefficients[power]
    if (Math.abs(coefficient) < 1e-12) continue
    const magnitude = formatCoefficient(Math.abs(coefficient))
    const term = power === 0 ? magnitude : power === 1 ? `${magnitude}x` : `${magnitude}x^${power}`
    if (!parts.length) parts.push(`${coefficient < 0 ? '−' : ''}${term}`)
    else parts.push(`${coefficient < 0 ? '−' : '+'} ${term}`)
  }
  return parts.length ? `y = ${parts.join(' ')}` : 'y = 0'
}

export function formatCoefficient(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const abs = Math.abs(value)
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e5)) return value.toExponential(4)
  return String(Number(value.toPrecision(6)))
}

export function formatStat(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (!Number.isFinite(value)) return 'Not finite'
  const abs = Math.abs(value)
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e6)) return value.toExponential(digits - 1)
  return String(Number(value.toFixed(digits)))
}

export function histogram(values, binCount = 0) {
  const data = cleanNumbers(values)
  if (!data.length) return { bins: [], min: null, max: null, count: 0 }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const bins = Math.max(1, binCount || Math.ceil(Math.log2(data.length) + 1))
  const width = max === min ? 1 : (max - min) / bins
  const result = Array.from({ length: bins }, (_, index) => ({
    x0: min + index * width,
    x1: min + (index + 1) * width,
    count: 0
  }))
  for (const value of data) {
    let index = width === 0 ? 0 : Math.floor((value - min) / width)
    if (index >= bins) index = bins - 1
    if (index < 0) index = 0
    result[index].count += 1
  }
  return { bins: result, min, max, count: data.length }
}

export function linearInterpolate(xs, ys, target) {
  const pairs = pairedClean(xs, ys).sort((a, b) => a[0] - b[0])
  if (pairs.length < 2) return { error: 'Interpolation needs at least 2 complete (x, y) pairs.' }
  if (!Number.isFinite(target)) return { error: 'Enter a numeric target X value.' }
  if (target < pairs[0][0] || target > pairs[pairs.length - 1][0]) {
    return { error: 'Target X is outside the data range; extrapolation is not performed.' }
  }
  for (let index = 0; index < pairs.length - 1; index += 1) {
    const [x0, y0] = pairs[index]
    const [x1, y1] = pairs[index + 1]
    if (target >= x0 && target <= x1) {
      if (x1 === x0) return { x: target, y: y0, method: 'linear' }
      return { x: target, y: y0 + ((target - x0) / (x1 - x0)) * (y1 - y0), method: 'linear' }
    }
  }
  return { error: 'Interpolation failed for this target.' }
}

const T95 = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 12: 2.179, 15: 2.131, 20: 2.086, 30: 2.042, 60: 2.0 }

export function meanConfidenceInterval95(values) {
  const data = cleanNumbers(values)
  if (data.length < 2) return null
  const df = data.length - 1
  const critical = T95[df] || (df > 60 ? 1.96 : 2.0)
  const sem = standardDeviation(data) / Math.sqrt(data.length)
  const margin = critical * sem
  return { mean: mean(data), lower: mean(data) - margin, upper: mean(data) + margin, df, critical }
}

export function boxStats(values) {
  const data = cleanNumbers(values).sort((a, b) => a - b)
  if (!data.length) return null
  const q1 = percentileSorted(data, 0.25)
  const q3 = percentileSorted(data, 0.75)
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr
  const inliers = data.filter((value) => value >= lowerBound && value <= upperBound)
  return {
    min: data[0],
    max: data[data.length - 1],
    q1,
    median: percentileSorted(data, 0.5),
    q3,
    lowerWhisker: inliers.length ? inliers[0] : data[0],
    upperWhisker: inliers.length ? inliers[inliers.length - 1] : data[data.length - 1],
    outliers: data.filter((value) => value < lowerBound || value > upperBound)
  }
}

// ---------------------------------------------------------------------------
// Outlier detection
// ---------------------------------------------------------------------------

const GRUBBS_CRITICAL = {
  3: 1.153, 4: 1.463, 5: 1.672, 6: 1.822, 7: 1.938, 8: 2.032, 9: 2.11, 10: 2.176,
  11: 2.234, 12: 2.285, 13: 2.331, 14: 2.371, 15: 2.409, 16: 2.443, 17: 2.475,
  18: 2.504, 19: 2.532, 20: 2.557, 25: 2.663, 30: 2.745, 40: 2.866, 50: 2.956
}

function grubbsCritical(n) {
  if (n < 3) return null
  if (GRUBBS_CRITICAL[n]) return GRUBBS_CRITICAL[n]
  // Two-tailed alpha = 0.05 approximation for larger n.
  const t = 1.96
  return ((n - 1) / Math.sqrt(n)) * Math.sqrt((t * t) / (2 * n - 2 + t * t)) * Math.sqrt(n - 2 + t * t) / Math.sqrt(n - 2 + t * t) || null
}

/**
 * Grubbs' test for a single outlier (largest absolute standardised residual).
 * @param {number[]} values
 * @returns {any}
 */
export function grubbsTest(values) {
  const data = cleanNumbers(values)
  const n = data.length
  if (n < 3) return { error: 'Grubbs test needs at least 3 numeric values.', n }
  const average = mean(data)
  const sd = standardDeviation(data, true)
  if (!sd) return { error: 'All values are identical; no outlier can be identified.', n }
  let maxIndex = 0
  let maxZ = 0
  data.forEach((value, index) => {
    const z = Math.abs(value - average) / sd
    if (z > maxZ) { maxZ = z; maxIndex = index }
  })
  const critical = grubbsCritical(n)
  const isOutlier = critical !== null && maxZ > critical
  return {
    n,
    statistic: maxZ,
    critical,
    isOutlier,
    index: maxIndex,
    value: data[maxIndex],
    mean: average,
    sd,
    label: isOutlier ? 'Outlier detected at \u03b1 = 0.05' : 'No outlier at \u03b1 = 0.05'
  }
}

/**
 * Iterative Grubbs test. Repeatedly removes the most extreme value while the
 * test is significant, up to a safety limit.
 * @param {number[]} values
 * @param {number} [maxOutliers]
 * @returns {any}
 */
export function grubbsOutliers(values, maxOutliers = 25) {
  let data = cleanNumbers(values)
  const removed = []
  let guard = 0
  while (data.length >= 3 && removed.length < maxOutliers && guard < values.length + 5) {
    guard += 1
    const test = grubbsTest(data)
    if (test.error || !test.isOutlier) break
    removed.push({ value: test.value, statistic: test.statistic, critical: test.critical })
    data = data.filter((_, index) => index !== test.index)
  }
  return { removed, remaining: data, removedCount: removed.length }
}

/**
 * IQR (Tukey) outlier bounds and indices.
 * @param {number[]} values
 * @param {number} [factor]
 * @returns {any}
 */
export function iqrOutliers(values, factor = 1.5) {
  const data = cleanNumbers(values)
  if (data.length < 4) return { lower: null, upper: null, indices: [], values: [], factor }
  const sorted = [...data].sort((a, b) => a - b)
  const q1 = percentileSorted(sorted, 0.25)
  const q3 = percentileSorted(sorted, 0.75)
  const iqr = q3 - q1
  const lower = q1 - factor * iqr
  const upper = q3 + factor * iqr
  const indices = []
  const flagged = []
  data.forEach((value, index) => {
    if (value < lower || value > upper) { indices.push(index); flagged.push(value) }
  })
  return { lower, upper, q1, q3, iqr, indices, values: flagged, factor }
}

// ---------------------------------------------------------------------------
// Column math helpers
// ---------------------------------------------------------------------------

export function movingAverage(values, window = 3) {
  const size = Math.max(1, Math.round(window))
  const source = values || []
  return source.map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    let total = 0
    let count = 0
    for (let offset = -Math.floor(size / 2); offset <= Math.floor(size / 2); offset += 1) {
      const neighbour = source[index + offset]
      if (typeof neighbour === 'number' && Number.isFinite(neighbour)) { total += neighbour; count += 1 }
    }
    return count ? total / count : value
  })
}

export function normalizeColumn(values, mode = 'minmax') {
  const data = cleanNumbers(values)
  if (!data.length) return values.map(() => null)
  if (mode === 'zscore') {
    const average = mean(data)
    const sd = standardDeviation(data, true)
    return values.map((value) => (typeof value === 'number' && Number.isFinite(value) && sd ? (value - average) / sd : null))
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min
  return values.map((value) => (typeof value === 'number' && Number.isFinite(value) && span ? (value - min) / span : span === 0 ? 0 : null))
}

export function ratioColumns(numerators, denominators) {
  const length = Math.min(numerators?.length || 0, denominators?.length || 0)
  const output = []
  for (let index = 0; index < length; index += 1) {
    const a = numerators[index]
    const b = denominators[index]
    output.push(typeof a === 'number' && typeof b === 'number' && b !== 0 && Number.isFinite(a) && Number.isFinite(b) ? a / b : null)
  }
  return output
}

export function numericalDerivative(xs, ys) {
  const pairs = pairedClean(xs, ys).sort((a, b) => a[0] - b[0])
  return pairs.map((pair, index) => {
    const prev = pairs[index - 1]
    const next = pairs[index + 1]
    if (prev && next) {
      const dx = next[0] - prev[0]
      return { x: pair[0], dydx: dx === 0 ? null : (next[1] - prev[1]) / dx }
    }
    if (next) {
      const dx = next[0] - pair[0]
      return { x: pair[0], dydx: dx === 0 ? null : (next[1] - pair[1]) / dx }
    }
    if (prev) {
      const dx = pair[0] - prev[0]
      return { x: pair[0], dydx: dx === 0 ? null : (pair[1] - prev[1]) / dx }
    }
    return { x: pair[0], dydx: null }
  })
}

// ---------------------------------------------------------------------------
// Non-linear curve fitting (Levenberg-Marquardt least squares)
// ---------------------------------------------------------------------------

export const FIT_MODELS = [
  { id: 'exponential', label: 'Exponential (a·e^(b·x))', params: ['a', 'b'] },
  { id: 'logarithmic', label: 'Logarithmic (a + b·ln(x))', params: ['a', 'b'] },
  { id: 'power', label: 'Power law (a·x^b)', params: ['a', 'b'] },
  { id: 'gaussian', label: 'Gaussian (A·e^(−(x−μ)²/2σ²))', params: ['A', 'mu', 'sigma'] },
  { id: 'lorentzian', label: 'Lorentzian (A·γ²/((x−x₀)²+γ²))', params: ['A', 'x0', 'gamma'] }
]

function modelPredict(id, params, x) {
  switch (id) {
    case 'exponential': return params[0] * Math.exp(params[1] * x)
    case 'logarithmic': return params[0] + params[1] * Math.log(x)
    case 'power': return params[0] * x ** params[1]
    case 'gaussian': return params[0] * Math.exp(-((x - params[1]) ** 2) / (2 * params[2] ** 2))
    case 'lorentzian': return params[0] * (params[2] ** 2) / ((x - params[1]) ** 2 + params[2] ** 2)
    default: return NaN
  }
}

function modelGradient(id, params, x) {
  switch (id) {
    case 'exponential':
      return [Math.exp(params[1] * x), params[0] * x * Math.exp(params[1] * x)]
    case 'logarithmic':
      return [1, Math.log(x)]
    case 'power':
      return [x ** params[1], params[0] * x ** params[1] * Math.log(x)]
    case 'gaussian': {
      const g = Math.exp(-((x - params[1]) ** 2) / (2 * params[2] ** 2))
      return [
        g,
        params[0] * g * (x - params[1]) / (params[2] ** 2),
        params[0] * g * ((x - params[1]) ** 2) / (params[2] ** 3)
      ]
    }
    case 'lorentzian': {
      const denom = (x - params[1]) ** 2 + params[2] ** 2
      return [
        (params[2] ** 2) / denom,
        params[0] * (params[2] ** 2) * (2 * (x - params[1])) / (denom ** 2),
        params[0] * (2 * params[2] * denom - params[2] ** 2 * 2 * params[2]) / (denom ** 2)
      ]
    }
    default: return params.map(() => 0)
  }
}

function initialGuess(id, pairs) {
  const xs = pairs.map((pair) => pair[0])
  const ys = pairs.map((pair) => pair[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  switch (id) {
    case 'exponential': return [maxY / 2 || 1, 1 / Math.max(1, maxX - minX)]
    case 'logarithmic': return [mean(ys), 1]
    case 'power': return [maxY || 1, 1]
    case 'gaussian': return [maxY || 1, (minX + maxX) / 2, Math.max(0.1, (maxX - minX) / 6)]
    case 'lorentzian': return [maxY || 1, (minX + maxX) / 2, Math.max(0.1, (maxX - minX) / 6)]
    default: return [1]
  }
}

function sumSquares(id, params, pairs) {
  let total = 0
  for (const [x, y] of pairs) {
    const predicted = modelPredict(id, params, x)
    if (!Number.isFinite(predicted)) return Infinity
    total += (y - predicted) ** 2
  }
  return total
}

/**
 * Fit one of the built-in non-linear models with Levenberg-Marquardt.
 * @param {string} id
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {any}
 */
export function nonlinearFit(id, xs, ys) {
  const pairs = pairedClean(xs, ys)
  const model = FIT_MODELS.find((entry) => entry.id === id)
  if (!model) return { error: `Unknown fit model: ${id}` }
  if (pairs.length < model.params.length + 1) {
    return { error: `${model.label} needs at least ${model.params.length + 1} complete (x, y) pairs.` }
  }
  if (id === 'logarithmic' && pairs.some(([x]) => x <= 0)) return { error: 'Logarithmic fit needs positive X values.' }
  if (id === 'power' && pairs.some(([x]) => x <= 0)) return { error: 'Power-law fit needs positive X values.' }

  let params = initialGuess(id, pairs)
  let lambda = 0.001
  let current = sumSquares(id, params, pairs)
  const size = params.length
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const normal = Array.from({ length: size }, () => new Array(size).fill(0))
    const gradient = new Array(size).fill(0)
    for (const [x, y] of pairs) {
      const predicted = modelPredict(id, params, x)
      const residual = y - predicted
      const jac = modelGradient(id, params, x)
      for (let row = 0; row < size; row += 1) {
        gradient[row] += jac[row] * residual
        for (let col = 0; col < size; col += 1) normal[row][col] += jac[row] * jac[col]
      }
    }
    let improved = false
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const damped = normal.map((row, index) => row.map((value, col) => value + (index === col ? lambda * (value || 1) : 0)))
      const solution = solveLinearSystem(damped, gradient)
      if (!solution) { lambda *= 10; continue }
      const candidate = params.map((value, index) => value + solution[index])
      const candidateSum = sumSquares(id, candidate, pairs)
      if (Number.isFinite(candidateSum) && candidateSum < current) {
        params = candidate
        const reduction = current - candidateSum
        current = candidateSum
        lambda = Math.max(1e-10, lambda / 10)
        improved = true
        if (reduction < 1e-12 * (1 + current)) { iteration = 1000; break }
        break
      }
      lambda *= 10
    }
    if (!improved) break
  }

  const fitted = pairs.map(([x]) => modelPredict(id, params, x))
  const residuals = pairs.map(([, y], index) => y - fitted[index])
  const ssRes = residuals.reduce((acc, value) => acc + value ** 2, 0)
  const my = mean(pairs.map((pair) => pair[1]))
  const ssTot = pairs.reduce((acc, [, y]) => acc + (y - my) ** 2, 0)
  const dof = pairs.length - size
  const r2 = ssTot === 0 ? null : 1 - ssRes / ssTot
  const adjustedR2 = r2 === null || dof <= 0 || pairs.length <= 1 ? null : 1 - (1 - r2) * (pairs.length - 1) / dof
  const residualVariance = dof > 0 ? ssRes / dof : null
  const parameterErrors = computeParameterErrors(id, params, pairs, residualVariance)
  return {
    model: id,
    label: model.label,
    parameters: params,
    parameterNames: model.params,
    parameterErrors,
    equation: modelEquation(id, params),
    x: pairs.map((pair) => pair[0]),
    y: pairs.map((pair) => pair[1]),
    fitted,
    residuals,
    ssRes,
    ssTot,
    r2,
    adjustedR2,
    dof,
    rmse: Math.sqrt(ssRes / Math.max(1, pairs.length)),
    n: pairs.length,
    predict: (value) => modelPredict(id, params, value)
  }
}

function computeParameterErrors(id, params, pairs, residualVariance) {
  if (residualVariance === null) return params.map(() => null)
  const size = params.length
  const normal = Array.from({ length: size }, () => new Array(size).fill(0))
  for (const [x] of pairs) {
    const jac = modelGradient(id, params, x)
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) normal[row][col] += jac[row] * jac[col]
    }
  }
  const inverse = invertMatrix(normal)
  if (!inverse) return params.map(() => null)
  return params.map((_, index) => {
    const variance = residualVariance * inverse[index][index]
    return variance >= 0 ? Math.sqrt(variance) : null
  })
}

function invertMatrix(matrix) {
  const n = matrix.length
  const a = matrix.map((row, index) => [...row, ...Array.from({ length: n }, (_, col) => (index === col ? 1 : 0))])
  for (let column = 0; column < n; column += 1) {
    let pivot = column
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row
    }
    if (Math.abs(a[pivot][column]) < 1e-12) return null
    ;[a[column], a[pivot]] = [a[pivot], a[column]]
    const pivotValue = a[column][column]
    for (let col = 0; col < 2 * n; col += 1) a[column][col] /= pivotValue
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue
      const factor = a[row][column]
      if (factor === 0) continue
      for (let col = 0; col < 2 * n; col += 1) a[row][col] -= factor * a[column][col]
    }
  }
  return a.map((row) => row.slice(n))
}

function modelEquation(id, params) {
  const p = params.map((value) => formatCoefficient(value))
  switch (id) {
    case 'exponential': return `y = ${p[0]}·e^(${p[1]}x)`
    case 'logarithmic': return `y = ${p[0]} + ${p[1]}·ln(x)`
    case 'power': return `y = ${p[0]}·x^${p[1]}`
    case 'gaussian': return `y = ${p[0]}·e^(−(x−${p[1]})²/(2·${p[2]}²))`
    case 'lorentzian': return `y = ${p[0]}·${p[2]}²/((x−${p[1]})²+${p[2]}²)`
    default: return 'y = ?'
  }
}

/**
 * Fit every available model and rank by adjusted R².
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {any}
 */
export function fitAllModels(xs, ys) {
  return FIT_MODELS
    .map((model) => nonlinearFit(model.id, xs, ys))
    .filter((result) => !result.error)
    .sort((a, b) => (b.adjustedR2 ?? -Infinity) - (a.adjustedR2 ?? -Infinity))
}
