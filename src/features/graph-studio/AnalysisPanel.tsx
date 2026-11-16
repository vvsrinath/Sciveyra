import { useMemo, useState } from 'react'
import { Activity, Calculator, Download, Info, Plus, X } from 'lucide-react'
import { Button, Callout, Card, Field, Input, Select, Tabs } from '../../components/ui'
import { columnValues, pairedValues } from '../../lib/parse.js'
import {
  describe, formatStat, linearRegression, polynomialRegression, pearson, spearman,
  meanConfidenceInterval95, linearInterpolate, formatCoefficient,
  FIT_MODELS, fitAllModels, nonlinearFit, grubbsTest, grubbsOutliers, iqrOutliers,
  movingAverage, normalizeColumn, numericalDerivative
} from '../../lib/stats.js'
import { downloadText } from '../../lib/export.js'
import type { Dataset, GraphConfig } from '../../types'

type Props = {
  dataset: Dataset | null
  config: GraphConfig
  onAddFit: (result: Record<string, unknown>, label: string) => void
  onClearFit: () => void
  hasFit: boolean
  notify: (message: string, tone?: 'success' | 'error' | 'info' | 'warning') => void
}

type Tab = 'statistics' | 'regression' | 'curvefit' | 'outliers' | 'interpolation'

export default function AnalysisPanel({ dataset, config, onAddFit, onClearFit, hasFit, notify }: Props) {
  const [tab, setTab] = useState<Tab>('statistics')
  const [degree, setDegree] = useState('2')
  const [target, setTarget] = useState('')
  const [interpResult, setInterpResult] = useState<{ x?: number; y?: number; error?: string } | null>(null)
  const [fitModel, setFitModel] = useState('exponential')
  const [outlierMethod, setOutlierMethod] = useState('grubbs')

  const xKey = config.xKey
  const yKey = config.yKeys[0]
  const xValues = useMemo(() => dataset ? columnValues(dataset, xKey) : [], [dataset, xKey])
  const yValues = useMemo(() => dataset ? columnValues(dataset, yKey) : [], [dataset, yKey])
  const pairs = useMemo(() => dataset ? pairedValues(dataset, xKey, yKey) : { xs: [], ys: [] }, [dataset, xKey, yKey])
  const stats = useMemo(() => describe(yValues), [yValues])
  const xStats = useMemo(() => describe(xValues), [xValues])
  const ci = useMemo(() => meanConfidenceInterval95(yValues), [yValues])
  const linear = useMemo(() => pairs.xs.length ? linearRegression(pairs.xs, pairs.ys) : null, [pairs])
  const polynomial = useMemo(() => pairs.xs.length ? polynomialRegression(pairs.xs, pairs.ys, Number(degree)) : null, [pairs, degree])
  const r = useMemo(() => pairs.xs.length > 1 ? pearson(pairs.xs, pairs.ys) : null, [pairs])
  const rho = useMemo(() => pairs.xs.length > 1 ? spearman(pairs.xs, pairs.ys) : null, [pairs])
  const curveFit = useMemo(() => pairs.xs.length ? nonlinearFit(fitModel, pairs.xs, pairs.ys) : null, [pairs, fitModel])
  const modelRanking = useMemo(() => pairs.xs.length ? fitAllModels(pairs.xs, pairs.ys) : [], [pairs])
  const outlierReport = useMemo(() => {
    if (!yValues.length) return null
    const values = yValues as number[]
    if (outlierMethod === 'iqr') return iqrOutliers(values)
    const single = grubbsTest(values)
    const iterative = grubbsOutliers(values)
    return { ...single, ...iterative, mode: 'grubbs' }
  }, [yValues, outlierMethod])
  const columnMath = useMemo(() => ({
    smooth3: movingAverage(yValues as number[], 3),
    normalized: normalizeColumn(yValues as number[], 'minmax'),
    zscore: normalizeColumn(yValues as number[], 'zscore'),
    derivative: numericalDerivative(xValues as number[], yValues as number[])
  }), [xValues, yValues])

  if (!dataset || !yKey) {
    return <Card className="p-4"><Callout tone="info">Select a numeric X and at least one Y series to view statistics.</Callout></Card>
  }

  const addLinear = () => {
    if (!linear || linear.error) { notify(linear?.error || 'Linear regression is not available.', 'error'); return }
    onAddFit({ ...linear, label: 'Linear fit' }, 'Linear fit')
    notify('Linear regression line added to the chart.', 'success')
  }
  const addPolynomial = () => {
    if (!polynomial || polynomial.error) { notify(polynomial?.error || 'Polynomial fit is not available.', 'error'); return }
    onAddFit({ ...polynomial, label: `Polynomial fit (degree ${degree})` }, `Polynomial fit (degree ${degree})`)
    notify(`Degree ${degree} polynomial fitted line added to the chart.`, 'success')
  }
  const addCurveFit = (modelId: string) => {
    const result = nonlinearFit(modelId, pairs.xs, pairs.ys)
    if (result.error) { notify(result.error, 'error'); return }
    const label = `${result.label} fit`
    onAddFit({ ...result, label }, label)
    notify(`${label} added to the chart.`, 'success')
  }
  const interpolate = () => {
    const result = linearInterpolate(pairs.xs, pairs.ys, Number(target))
    setInterpResult(result)
    if (result.error) notify(result.error, 'warning')
  }
  const exportAnalysis = () => {
    const lines = [
      `SciVeyra analysis export`,
      `Dataset,${dataset.name}`,
      `X column,${columnLabel(xKey)}`,
      `Y column,${columnLabel(yKey)}`,
      `Synthetic or imported,${dataset.source === 'sample' ? 'Synthetic sample data' : 'User-provided data'}`,
      '',
      'Descriptive statistics (Y)',
      'count,missing,mean,median,std_dev_sample,variance_sample,min,max,range,q1,q3,iqr,sem,cv',
      [stats.n, stats.missing, stats.mean, stats.median, stats.sd, stats.variance, stats.min, stats.max, stats.range, stats.q1, stats.q3, stats.iqr, stats.sem, stats.cv].map((value) => value ?? '').join(','),
      '',
      'Confidence interval of the mean (95%, t distribution)',
      ci ? `mean,lower,upper,df,critical_t\n${ci.mean},${ci.lower},${ci.upper},${ci.df},${ci.critical}` : 'Not enough complete observations.',
      '',
      'Correlation',
      `pearson_r,${r ?? ''}`,
      `spearman_rho,${rho ?? ''}`,
      '',
      'Linear regression (ordinary least squares)',
      linear && !linear.error ? `slope,intercept,r,r_squared,n,slope_standard_error,intercept_standard_error\n${linear.slope},${linear.intercept},${linear.r},${linear.r2},${linear.n},${linear.slopeStdErr},${linear.interceptStdErr}` : linear?.error || 'Not available.',
      '',
      `Polynomial regression (degree ${degree})`,
      polynomial && !polynomial.error ? `coefficients_low_to_high,${polynomial.coefficients.join(';')},r_squared,${polynomial.r2},n,${polynomial.n}` : polynomial?.error || 'Not available.',
      '',
      `Non-linear curve fit (${FIT_MODELS.find((model) => model.id === fitModel)?.label || fitModel})`,
      curveFit && !curveFit.error ? `equation,${curveFit.equation}\nparameter,estimate,standard_error\n${curveFit.parameterNames.map((name: string, index: number) => `${name},${curveFit.parameters[index]},${curveFit.parameterErrors?.[index] ?? ''}`).join('\n')}\nr_squared,${curveFit.r2},adjusted_r_squared,${curveFit.adjustedR2},rmse,${curveFit.rmse},n,${curveFit.n},dof,${curveFit.dof}` : curveFit?.error || 'Not available.',
      '',
      'Outlier detection',
      outlierMethod === 'grubbs'
        ? (outlierReport?.error ? outlierReport.error : `method,grubbs\nmax_g,${outlierReport?.statistic},critical,${outlierReport?.critical},verdict,${outlierReport?.isOutlier ? 'outlier' : 'none'},iterative_removed,${outlierReport?.removedCount}`)
        : `method,iqr\nlower_fence,${outlierReport?.lower},upper_fence,${outlierReport?.upper},flagged,${outlierReport?.indices?.length ?? 0}`,
      '',
      'Assumptions: ordinary least squares assumes independent observations, a linear/polynomial mean model, and homoscedastic residuals. R² is descriptive and does not prove causation. Outlier tests flag statistical extremes and are not proof of measurement error.'
    ]
    downloadText(lines.join('\n'), `sciveyra-analysis-${dataset.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, 'text/csv;charset=utf-8')
    notify('Analysis report exported as CSV.', 'success')
  }
  const columnLabel = (key: string) => dataset.columns.find((column) => column.key === key)?.name || key

  return <Card className="p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-slate-100"><Calculator size={16} className="text-blue-500" />Analysis</h2>
        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{columnLabel(xKey)} → {columnLabel(yKey)} · {pairs.xs.length.toLocaleString()} complete pairs</p>
      </div>
      <Button size="sm" variant="secondary" onClick={exportAnalysis} icon={<Download size={13} />}>Export report</Button>
    </div>
    <Tabs tabs={[{ id: 'statistics', label: 'Statistics' }, { id: 'regression', label: 'Regression' }, { id: 'curvefit', label: 'Curve fit' }, { id: 'outliers', label: 'Outliers' }, { id: 'interpolation', label: 'Interpolation' }]} value={tab} onChange={setTab} />

    {tab === 'statistics' && <div className="mt-3 space-y-3">
      <div className="overflow-auto rounded-lg border border-slate-100 dark:border-slate-800">
        <table className="w-full border-collapse text-left text-[11px]">
          <caption className="sr-only">Descriptive statistics for the selected Y column</caption>
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th className="p-2">Statistic</th><th className="p-2">Y: {columnLabel(yKey)}</th><th className="p-2">X: {columnLabel(xKey)}</th></tr></thead>
          <tbody className="text-slate-600 dark:text-slate-300">
            {[
              ['Count (n)', stats.n, xStats.n],
              ['Missing', stats.missing, xStats.missing],
              ['Mean', formatStat(stats.mean), formatStat(xStats.mean)],
              ['Median', formatStat(stats.median), formatStat(xStats.median)],
              ['Std. deviation (sample)', formatStat(stats.sd), formatStat(xStats.sd)],
              ['Variance (sample)', formatStat(stats.variance), formatStat(xStats.variance)],
              ['Minimum', formatStat(stats.min), formatStat(xStats.min)],
              ['Maximum', formatStat(stats.max), formatStat(xStats.max)],
              ['Q1', formatStat(stats.q1), formatStat(xStats.q1)],
              ['Q3', formatStat(stats.q3), formatStat(xStats.q3)],
              ['IQR', formatStat(stats.iqr), formatStat(xStats.iqr)],
              ['SEM', formatStat(stats.sem), formatStat(xStats.sem)],
              ['CV', stats.cv === null ? '—' : `${formatStat(stats.cv * 100, 2)}%`, xStats.cv === null ? '—' : `${formatStat(xStats.cv * 100, 2)}%`]
            ].map(([label, y, x]) => <tr key={String(label)} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2 font-semibold">{label}</td><td className="p-2">{y}</td><td className="p-2">{x}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label="Pearson r" value={r === null ? '—' : formatStat(r)} />
        <Metric label="Spearman ρ" value={rho === null ? '—' : formatStat(rho)} />
        <Metric label="Mean 95% CI" value={ci ? `${formatStat(ci.lower)} – ${formatStat(ci.upper)}` : '—'} />
      </div>
      <Callout tone="info"><Info size={13} className="mr-1 inline" />The 95% mean interval uses a t critical value and assumes approximately independent observations. It is not a prediction interval.</Callout>
    </div>}

    {tab === 'regression' && <div className="mt-3 space-y-3">
      <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Linear regression (OLS)</div>
          <Button size="sm" onClick={addLinear} disabled={!linear || !!linear.error} icon={<Plus size={12} />}>Add fit line</Button>
        </div>
        {linear?.error ? <Callout tone="warning">{linear.error}</Callout> : linear && <>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Metric label="Equation" value={linear.equation} mono />
            <Metric label="R² / r" value={`${formatStat(linear.r2)} / ${formatStat(linear.r)}`} />
            <Metric label="Slope ± SE" value={`${formatCoefficient(linear.slope)} ± ${formatStat(linear.slopeStdErr)}`} />
            <Metric label="Intercept ± SE" value={`${formatCoefficient(linear.intercept)} ± ${formatStat(linear.interceptStdErr)}`} />
          </div>
          <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">n = {linear.n}; residual sum of squares = {formatStat(linear.ssRes)}. OLS assumes independent observations, a linear mean relationship, and constant residual variance. Confidence intervals for parameters require the usual regression assumptions.</p>
        </>}
      </div>
      <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Polynomial regression</div>
          <div className="flex items-center gap-2">
            <Field label="Degree"><Select value={degree} onChange={(event) => setDegree(event.target.value)} className="h-8 w-20">{Array.from({ length: 8 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
            <Button size="sm" onClick={addPolynomial} disabled={!polynomial || !!polynomial.error} icon={<Plus size={12} />}>Add fit line</Button>
          </div>
        </div>
        {polynomial?.error ? <Callout tone="warning">{polynomial.error}</Callout> : polynomial && <>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Metric label="Equation" value={polynomial.equation} mono />
            <Metric label="R²" value={formatStat(polynomial.r2)} />
          </div>
          <p className="mt-2 break-words text-[10px] text-slate-500 dark:text-slate-400">Coefficients (low → high): {polynomial.coefficients.map((value: number) => formatCoefficient(value)).join(', ')}. High-degree polynomials can overfit and oscillate; compare with the linear fit and avoid extrapolation.</p>
        </>}
      </div>
      {hasFit && <Button size="sm" variant="ghost" onClick={onClearFit} icon={<X size={12} />}>Remove fitted line from chart</Button>}
      <Callout tone="warning">R² and fitted lines describe this dataset only. They do not establish causation, and fitted values outside the observed X range are extrapolations.</Callout>
    </div>}

    {tab === 'curvefit' && <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Model" className="min-w-[220px] flex-1"><Select value={fitModel} onChange={(event) => setFitModel(event.target.value)}>{FIT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</Select></Field>
        <Button size="sm" onClick={() => addCurveFit(fitModel)} disabled={!curveFit || !!curveFit.error} icon={<Plus size={12} />}>Add fit line</Button>
      </div>
      {curveFit?.error ? <Callout tone="warning">{curveFit.error}</Callout> : curveFit && <>
        <div className="grid gap-2 sm:grid-cols-2">
          <Metric label="Equation" value={curveFit.equation} mono />
          <Metric label="R² / adjusted R²" value={`${formatStat(curveFit.r2)} / ${formatStat(curveFit.adjustedR2)}`} />
          <Metric label="RMSE" value={formatStat(curveFit.rmse)} />
          <Metric label="n / degrees of freedom" value={`${curveFit.n} / ${curveFit.dof}`} />
        </div>
        <div className="overflow-auto rounded-lg border border-slate-100 dark:border-slate-800">
          <table className="w-full border-collapse text-left text-[11px]">
            <caption className="sr-only">Fitted parameters with standard errors</caption>
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th className="p-2">Parameter</th><th className="p-2">Estimate</th><th className="p-2">Standard error</th></tr></thead>
            <tbody className="text-slate-600 dark:text-slate-300">
              {curveFit.parameters.map((value: number, index: number) => <tr key={curveFit.parameterNames[index]} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2 font-mono font-semibold">{curveFit.parameterNames[index]}</td><td className="p-2 font-mono">{formatCoefficient(value)}</td><td className="p-2 font-mono">{formatStat(curveFit.parameterErrors?.[index] ?? null)}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Model ranking by adjusted R²</div>
          <div className="flex flex-wrap gap-1.5">
            {modelRanking.map((entry: { model: string; label: string; adjustedR2: number | null }) => <button key={entry.model} type="button" onClick={() => setFitModel(entry.model)} className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition ${entry.model === fitModel ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-slate-200 text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:text-slate-300'}`}>{entry.model} · R²ᵃᵈʲ {formatStat(entry.adjustedR2)}</button>)}
          </div>
        </div>
      </>}
      {hasFit && <Button size="sm" variant="ghost" onClick={onClearFit} icon={<X size={12} />}>Remove fitted line from chart</Button>}
      <Callout tone="info"><Info size={13} className="mr-1 inline" />Non-linear fits use least-squares with numerical gradients. Parameter standard errors come from the covariance matrix and assume independent, roughly homoscedastic residuals. Compare candidates with adjusted R² to avoid overfitting.</Callout>
    </div>}

    {tab === 'outliers' && <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Method" className="min-w-[180px] flex-1"><Select value={outlierMethod} onChange={(event) => setOutlierMethod(event.target.value)}><option value="grubbs">Grubbs' test</option><option value="iqr">IQR (Tukey fences)</option></Select></Field>
      </div>
      {outlierMethod === 'grubbs' ? <>
        {outlierReport?.error ? <Callout tone="warning">{outlierReport.error}</Callout> : outlierReport && <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label="Max G statistic" value={formatStat(outlierReport.statistic)} />
            <Metric label="Critical (α = 0.05)" value={formatStat(outlierReport.critical)} />
            <Metric label="Verdict" value={outlierReport.isOutlier ? 'Outlier present' : 'No outlier'} />
          </div>
          <Callout tone={outlierReport.removedCount ? 'warning' : 'success'}>{outlierReport.removedCount ? `${outlierReport.removedCount} value(s) flagged iteratively: ${outlierReport.removed.map((entry: { value: number }) => formatStat(entry.value)).join(', ')}.` : 'No values were flagged as outliers by iterative Grubbs testing.'}</Callout>
        </>}
      </> : outlierReport && <>
        <div className="grid gap-2 sm:grid-cols-3">
          <Metric label="Lower fence" value={formatStat(outlierReport.lower ?? null)} />
          <Metric label="Upper fence" value={formatStat(outlierReport.upper ?? null)} />
          <Metric label="Flagged" value={String(outlierReport.indices?.length ?? 0)} />
        </div>
        <Callout tone={(outlierReport.indices?.length ?? 0) ? 'warning' : 'success'}>{(outlierReport.indices?.length ?? 0) ? `Values outside the fences: ${outlierReport.values.map((value: number) => formatStat(value)).join(', ')}.` : 'No values fall outside the 1.5·IQR fences.'}</Callout>
      </>}
      <p className="text-[10px] text-slate-500 dark:text-slate-400">Outliers are statistical flags, not errors. Investigate the underlying cause before excluding points; never delete data silently.</p>
      <details className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
        <summary className="cursor-pointer text-[11px] font-bold text-slate-700 dark:text-slate-200">Derived column preview (moving average, min-max, z-score, derivative)</summary>
        <div className="mt-2 max-h-52 overflow-auto rounded border border-slate-100 dark:border-slate-800">
          <table className="w-full border-collapse text-left text-[10px]">
            <caption className="sr-only">First rows of derived columns</caption>
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th className="p-1.5">X</th><th className="p-1.5">Y</th><th className="p-1.5">Smooth(3)</th><th className="p-1.5">Min-max</th><th className="p-1.5">z-score</th><th className="p-1.5">dY/dX</th></tr></thead>
            <tbody className="text-slate-600 dark:text-slate-300">
              {xValues.slice(0, 25).map((x, index) => <tr key={index} className="border-t border-slate-100 dark:border-slate-800"><td className="p-1.5 font-mono">{formatStat(x as number)}</td><td className="p-1.5 font-mono">{formatStat((yValues[index] as number) ?? null)}</td><td className="p-1.5 font-mono">{formatStat(columnMath.smooth3[index] ?? null)}</td><td className="p-1.5 font-mono">{formatStat(columnMath.normalized[index] ?? null)}</td><td className="p-1.5 font-mono">{formatStat(columnMath.zscore[index] ?? null)}</td><td className="p-1.5 font-mono">{formatStat(columnMath.derivative[index]?.dydx ?? null)}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Preview shows the first 25 rows. The derivative uses central differences for interior points.</p>
      </details>
    </div>}

    {tab === 'interpolation' && <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label={`Target ${columnLabel(xKey)}`} className="min-w-[180px] flex-1"><Input type="number" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Enter an X value inside the data range" /></Field>
        <Button size="sm" onClick={interpolate} icon={<Activity size={13} />}>Interpolate</Button>
      </div>
      {interpResult?.error ? <Callout tone="warning">{interpResult.error}</Callout> : interpResult && <Metric label={`Linear interpolation at X = ${formatStat(interpResult.x ?? null)}`} value={formatStat(interpResult.y ?? null)} />}
      <Callout tone="info">Linear interpolation is performed between adjacent complete (X, Y) pairs after sorting by X. No extrapolation is performed. It should not be used to infer a physical mechanism or to replace measurement.</Callout>
    </div>}
  </Card>
}

function Metric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
    <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
    <div className={`mt-1 break-words text-[11px] font-semibold text-slate-700 dark:text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>
}
