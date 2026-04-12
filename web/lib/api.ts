import type { ExperimentConfig, ExperimentResult } from './types'

export async function runAnalysis(
  file: File,
  config: ExperimentConfig,
): Promise<ExperimentResult> {
  const form = new FormData()
  form.append('csv', file)
  form.append('config', JSON.stringify(config))

  const res = await fetch('/api/analyze', { method: 'POST', body: form })
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error ?? 'Analysis failed')
  }

  return data as ExperimentResult
}
