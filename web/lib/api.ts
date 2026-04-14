import type { ExperimentConfig, ExperimentResult } from './types'

export async function runAnalysis(
  file: File,
  config: ExperimentConfig,
): Promise<ExperimentResult> {
  const form = new FormData()
  form.append('csv', file)
  form.append('config', JSON.stringify(config))

  const res = await fetch('/api/analyze', { method: 'POST', body: form })

  if (!res.ok) {
    let message = 'Analysis failed'
    try {
      const data = await res.json()
      if (data.error) message = data.error
    } catch {
      // non-JSON error body — use default message
    }
    throw new Error(message)
  }

  const data = await res.json()
  if (!data || !data.metric_results) {
    throw new Error('Unexpected response from analysis API')
  }
  return data as ExperimentResult
}
