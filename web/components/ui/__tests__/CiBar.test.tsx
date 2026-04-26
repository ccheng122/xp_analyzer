import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CiBar } from '../CiBar'

describe('CiBar', () => {
  it('uses danger tone when isViolation is true (regardless of CI position)', () => {
    render(<CiBar lower={-0.02} upper={-0.005} isViolation direction="higher-is-better" />)
    expect(screen.getByTestId('ui-ci-bar')).toHaveAttribute('data-tone', 'danger')
  })

  it('uses success tone when CI is fully positive and direction is higher-is-better', () => {
    render(<CiBar lower={0.005} upper={0.02} isViolation={false} direction="higher-is-better" />)
    expect(screen.getByTestId('ui-ci-bar')).toHaveAttribute('data-tone', 'success')
  })

  it('uses success tone when CI is fully negative and direction is lower-is-better', () => {
    render(<CiBar lower={-0.02} upper={-0.005} isViolation={false} direction="lower-is-better" />)
    expect(screen.getByTestId('ui-ci-bar')).toHaveAttribute('data-tone', 'success')
  })

  it('uses neutral tone when the CI straddles zero', () => {
    render(<CiBar lower={-0.01} upper={0.01} isViolation={false} direction="higher-is-better" />)
    expect(screen.getByTestId('ui-ci-bar')).toHaveAttribute('data-tone', 'neutral')
  })

  it('renders ← worse on the left for higher-is-better', () => {
    render(<CiBar lower={-0.01} upper={0.01} isViolation={false} direction="higher-is-better" />)
    expect(screen.getByText('← worse')).toBeInTheDocument()
  })

  it('renders ← better on the left for lower-is-better', () => {
    render(<CiBar lower={-0.01} upper={0.01} isViolation={false} direction="lower-is-better" />)
    expect(screen.getByText('← better')).toBeInTheDocument()
  })

  it('renders 95% CI values formatted as percentage points', () => {
    render(<CiBar lower={0.005} upper={0.02} isViolation={false} direction="higher-is-better" />)
    expect(screen.getByText('95% CI [+0.5pp, +2.0pp]')).toBeInTheDocument()
  })

  it('renders the centre 0 tick label', () => {
    render(<CiBar lower={-0.01} upper={0.01} isViolation={false} direction="higher-is-better" />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('uses the h-ci-bar height token on the track', () => {
    const { container } = render(
      <CiBar lower={0} upper={0.01} isViolation={false} direction="higher-is-better" />
    )
    expect(container.querySelector('.h-ci-bar')).not.toBeNull()
  })
})
