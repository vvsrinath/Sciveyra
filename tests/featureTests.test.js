import { describe, expect, it } from 'vitest'
import { detectCapabilities, FEATURE_TEST_GROUPS, runFeatureTests } from '../src/lib/featureTests.js'

const fullCapabilities = {
  blob: true,
  objectUrl: true,
  anchorDownload: true,
  browserStorage: true,
  webgl: true
}

describe('built-in feature tester', () => {
  it('reports browser capabilities without throwing', () => {
    const capabilities = detectCapabilities()
    expect(Object.keys(capabilities)).toEqual(Object.keys(fullCapabilities))
    for (const value of Object.values(capabilities)) expect(typeof value).toBe('boolean')
  })

  it('runs every local check successfully when capabilities are available', () => {
    const report = runFeatureTests({ environment: fullCapabilities })
    expect(report.summary.total).toBeGreaterThanOrEqual(17)
    expect(report.summary.passed).toBe(report.summary.total)
    expect(report.summary.failed).toBe(0)
    expect(report.results).toHaveLength(report.summary.total)
    expect(report.ranAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    for (const result of report.results) {
      expect(result.status).toBe('pass')
      expect(result.detail.length).toBeGreaterThan(5)
      expect(typeof result.durationMs).toBe('number')
    }
  })

  it('reports missing capabilities as a failure instead of crashing', () => {
    const report = runFeatureTests({ environment: { ...fullCapabilities, webgl: false } })
    const capabilityCheck = report.results.find((result) => result.id === 'browser-capabilities')
    expect(capabilityCheck.status).toBe('fail')
    expect(capabilityCheck.detail).toContain('webgl')
    expect(report.summary.failed).toBe(1)
  })

  it('groups checks for the report UI', () => {
    expect(FEATURE_TEST_GROUPS).toEqual(expect.arrayContaining([
      'Data', '2D graphs', '3D graphs', 'Analysis', 'Graph quality', 'Library', 'Text lab', 'Environment'
    ]))
  })
})
