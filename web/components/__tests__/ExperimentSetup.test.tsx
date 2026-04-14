import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExperimentSetup } from '../wizard/ExperimentSetup'

const headers = ['variant', 'converted', 'revenue']
const csvFile = new File(['variant,converted\n0,1\n1,0\n'], 'data.csv')

describe('ExperimentSetup', () => {
  it('Continue button is disabled when fields are empty', () => {
    render(
      <ExperimentSetup
        headers={headers}
        csvFile={csvFile}
        config={{}}
        onUpdate={vi.fn()}
        onContinue={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('calls onContinue when all required fields are filled', async () => {
    const onContinue = vi.fn()
    const onUpdate = vi.fn()
    render(
      <ExperimentSetup
        headers={headers}
        csvFile={csvFile}
        config={{ experiment_name: 'Test', group_column: 'variant', control_group: '0' }}
        onUpdate={onUpdate}
        onContinue={onContinue}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('clears control_group when group_column changes', async () => {
    const onUpdate = vi.fn()
    render(
      <ExperimentSetup
        headers={headers}
        csvFile={csvFile}
        config={{ experiment_name: 'Test', group_column: 'variant', control_group: '0' }}
        onUpdate={onUpdate}
        onContinue={vi.fn()}
      />
    )
    await userEvent.selectOptions(screen.getByDisplayValue('variant'), 'converted')
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ group_column: 'converted', control_group: undefined })
    )
  })
})
