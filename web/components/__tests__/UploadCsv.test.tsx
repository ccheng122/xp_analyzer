import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadCsv } from '../wizard/UploadCsv'
import * as csvLib from '@/lib/csv'

describe('UploadCsv', () => {
  it('shows drop zone initially', () => {
    render(<UploadCsv onComplete={vi.fn()} />)
    expect(screen.getByText(/drop your csv/i)).toBeInTheDocument()
  })

  it('calls onComplete with parsed CSV after file selection', async () => {
    const onComplete = vi.fn()
    render(<UploadCsv onComplete={onComplete} />)

    const file = new File(['variant,converted\n0,1\n1,0\n'], 'data.csv', { type: 'text/csv' })
    const input = screen.getByTestId('csv-input')
    await userEvent.upload(input, file)

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    const arg = onComplete.mock.calls[0][0]
    expect(arg.headers).toContain('variant')
    expect(arg.rowCount).toBe(2)
    expect(arg.file).toBe(file)
  })

  it('shows error message when CSV parsing fails', async () => {
    vi.spyOn(csvLib, 'parseCsvFile').mockRejectedValueOnce(new Error('CSV is empty'))

    const onComplete = vi.fn()
    render(<UploadCsv onComplete={onComplete} />)

    const file = new File([''], 'empty.csv', { type: 'text/csv' })
    const input = screen.getByTestId('csv-input')
    await userEvent.upload(input, file)

    await waitFor(() => expect(screen.getByText('CSV is empty')).toBeInTheDocument())
    expect(onComplete).not.toHaveBeenCalled()
  })
})
