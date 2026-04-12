'use client'
import { useState } from 'react'
import type { WizardState, ExperimentConfig } from '@/lib/types'
import { StepIndicator } from './StepIndicator'

const STEPS = ['Upload CSV', 'Experiment Setup', 'Add Metrics', 'Review & Run', 'Results']

const DEFAULT_CONFIG: Partial<ExperimentConfig> = {
  significance_threshold: 0.05,
  correction_method: 'bonferroni',
  metrics: [],
}

export function WizardShell() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    csv: null,
    config: DEFAULT_CONFIG,
    result: null,
    error: null,
  })

  function advance() {
    setState(s => ({
      ...s,
      step: Math.min(s.step + 1, STEPS.length) as WizardState['step'],
      error: null,
    }))
  }

  function updateConfig(patch: Partial<ExperimentConfig>) {
    setState(s => ({ ...s, config: { ...s.config, ...patch } }))
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Experiment Analyzer</h1>
      <StepIndicator steps={STEPS} currentStep={state.step} />
      <div className="mt-6">
        {state.step === 1 && <div data-testid="step-1-placeholder">Step 1: Upload CSV</div>}
        {state.step === 2 && <div data-testid="step-2-placeholder">Step 2: Experiment Setup</div>}
        {state.step === 3 && <div data-testid="step-3-placeholder">Step 3: Add Metrics</div>}
        {state.step === 4 && <div data-testid="step-4-placeholder">Step 4: Review & Run</div>}
        {state.step === 5 && <div data-testid="step-5-placeholder">Step 5: Results</div>}
      </div>
    </div>
  )
}
