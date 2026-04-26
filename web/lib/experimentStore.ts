import type { ExperimentConfig, ExperimentResult } from './types'

export interface StoredExperiment {
  result: ExperimentResult
  config: ExperimentConfig
  csvFile: File
}

const store = new Map<string, StoredExperiment>()

export function setExperiment(id: string, value: StoredExperiment): void {
  store.set(id, value)
}

export function getExperiment(id: string): StoredExperiment | undefined {
  return store.get(id)
}
