import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAnalysis } from '../api'
import type { ExperimentConfig, ExperimentResult } from '../types'

const mockConfig: ExperimentConfig = {
  experiment_name: 'Test',
  group_column: 'variant',
  control_group: '0',
  significance_threshold: 0.05,
  correction_method: 'bonferroni',
  metrics: [
    { name: 'conv', column: 'converted', type: 'binary', role: 'primary', higher_is_better: true },
  ],
}

const mockResult: Partial<ExperimentResult> = {
  experiment_name: 'Test',
  recommendation: { decision: 'ship', rationale: 'Looks good', caveats: [] },
  metric_results: [],
}

describe('runAnalysis', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts csv and config as FormData, returns result', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResult), { status: 200 })
    )

    const file = new File(['a,b\n1,2'], 'data.csv')
    const result = await runAnalysis(file, mockConfig)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/analyze')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(FormData)

    const body = init!.body as FormData
    expect(body.get('csv')).toBe(file)
    expect(JSON.parse(body.get('config') as string)).toMatchObject({ experiment_name: 'Test' })
    expect(result).toMatchObject(mockResult)
  })

  it('throws with error message on non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Column not found' }), { status: 400 })
    )

    const file = new File(['a,b\n1,2'], 'data.csv')
    await expect(runAnalysis(file, mockConfig)).rejects.toThrow('Column not found')
  })
})
