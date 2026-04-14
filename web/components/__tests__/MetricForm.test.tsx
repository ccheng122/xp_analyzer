import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MetricForm } from '../wizard/MetricForm'

const headers = ['converted', 'canceled', 'revenue']

describe('MetricForm', () => {
  it('Add button is disabled when required fields are empty', () => {
    render(<MetricForm headers={headers} onAdd={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add metric/i })).toBeDisabled()
  })

  it('calls onAdd with metric when required fields are filled', async () => {
    const onAdd = vi.fn()
    render(<MetricForm headers={headers} onAdd={onAdd} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByPlaceholderText(/e\.g\./i), 'paid_conversion')
    const selects = screen.getAllByRole('combobox')
    await userEvent.selectOptions(selects[0], 'converted')

    await userEvent.click(screen.getByRole('button', { name: /add metric/i }))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'paid_conversion', column: 'converted' })
    )
  })

  it('advanced options are hidden by default', () => {
    render(<MetricForm headers={headers} onAdd={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByLabelText(/derive/i)).not.toBeInTheDocument()
  })

  it('advanced options are shown after clicking toggle', async () => {
    render(<MetricForm headers={headers} onAdd={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByText(/advanced options/i))
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThan(4)
  })
})
