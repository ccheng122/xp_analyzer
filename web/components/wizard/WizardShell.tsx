'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WizardState, ExperimentConfig } from '@/lib/types'
import { setExperiment } from '@/lib/experimentStore'
import { StepIndicator } from './StepIndicator'
import { UploadCsv } from './UploadCsv'
import { ExperimentSetup } from './ExperimentSetup'
import { AddMetrics } from './AddMetrics'
import { ReviewRun } from './ReviewRun'

const STEPS = ['Upload CSV', 'Experiment Setup', 'Add Metrics', 'Review & Run']

const DEFAULT_CONFIG: Partial<ExperimentConfig> = {
  significance_threshold: 0.05,
  correction_method: 'bonferroni',
  metrics: [],
}

const INITIAL_STATE: WizardState = {
  step: 1,
  csv: null,
  config: DEFAULT_CONFIG,
  error: null,
}

export function WizardShell() {
  const router = useRouter()
  const [state, setState] = useState<WizardState>(INITIAL_STATE)
  const [highestStep, setHighestStep] = useState(1)

  function advance() {
    setState(s => {
      const next = Math.min(s.step + 1, STEPS.length) as WizardState['step']
      setHighestStep(h => Math.max(h, next))
      return { ...s, step: next, error: null }
    })
  }

  function goToStep(step: number) {
    // Never go back to step 1 (would require re-uploading CSV); only navigate within reached steps
    if (step < 2 || step > highestStep) return
    setState(s => ({ ...s, step: step as WizardState['step'], error: null }))
  }

  function updateConfig(patch: Partial<ExperimentConfig>) {
    setState(s => ({ ...s, config: { ...s.config, ...patch } }))
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Experiment Analyzer</h1>
      <StepIndicator steps={STEPS} currentStep={state.step} onStepClick={state.csv ? goToStep : undefined} />

      <div className="mt-6">
        {state.step === 1 && (
          <UploadCsv
            onComplete={csv => {
              setState(s => ({ ...s, csv, step: 2 }))
            }}
          />
        )}
        {state.step === 2 && state.csv && (
          <ExperimentSetup
            headers={state.csv.headers}
            csvFile={state.csv.file}
            config={state.config}
            onUpdate={updateConfig}
            onContinue={advance}
          />
        )}
        {state.step === 3 && state.csv && (
          <AddMetrics
            headers={state.csv.headers}
            metrics={state.config.metrics ?? []}
            onUpdate={metrics => updateConfig({ metrics })}
            onContinue={advance}
          />
        )}
        {state.step === 4 && state.csv && (
          <ReviewRun
            csv={state.csv}
            config={state.config as ExperimentConfig}
            error={state.error}
            onResult={result => {
              const id = crypto.randomUUID()
              setExperiment(id, {
                result,
                config: state.config as ExperimentConfig,
                csvFile: state.csv!.file,
              })
              setState(INITIAL_STATE)
              setHighestStep(1)
              router.push(`/experiment/${id}`)
            }}
            onError={error => setState(s => ({ ...s, error }))}
          />
        )}
      </div>
    </div>
  )
}
