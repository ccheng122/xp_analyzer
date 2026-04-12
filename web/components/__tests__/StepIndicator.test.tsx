import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepIndicator } from '../wizard/StepIndicator'

const steps = ['Upload CSV', 'Experiment Setup', 'Add Metrics', 'Review & Run', 'Results']

describe('StepIndicator', () => {
  it('marks completed steps with a checkmark', () => {
    render(<StepIndicator steps={steps} currentStep={3} />)
    // Steps 1 and 2 are completed (before step 3)
    expect(screen.getAllByText('✓')).toHaveLength(2)
  })

  it('marks the current step as active', () => {
    render(<StepIndicator steps={steps} currentStep={2} />)
    const active = screen.getByTestId('step-active')
    expect(active).toHaveTextContent('Experiment Setup')
  })

  it('dims upcoming steps', () => {
    render(<StepIndicator steps={steps} currentStep={1} />)
    const upcoming = screen.getAllByTestId('step-upcoming')
    expect(upcoming).toHaveLength(4)
  })
})
