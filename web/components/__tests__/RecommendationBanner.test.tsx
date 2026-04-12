import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecommendationBanner } from '../report/RecommendationBanner'

describe('RecommendationBanner', () => {
  it('renders SHIP in green', () => {
    render(
      <RecommendationBanner
        decision="ship"
        rationale="Primary metric improved significantly."
      />
    )
    const banner = screen.getByTestId('recommendation-banner')
    expect(banner).toHaveClass('bg-green-50')
    expect(screen.getByText(/ship/i)).toBeInTheDocument()
  })

  it("renders DON'T SHIP in red", () => {
    render(
      <RecommendationBanner
        decision="don't ship"
        rationale="Guardrail violation detected."
      />
    )
    const banner = screen.getByTestId('recommendation-banner')
    expect(banner).toHaveClass('bg-red-50')
  })

  it('renders REVIEW GUARDRAIL in orange', () => {
    render(
      <RecommendationBanner
        decision="review guardrail"
        rationale="Guardrail needs review."
      />
    )
    const banner = screen.getByTestId('recommendation-banner')
    expect(banner).toHaveClass('bg-orange-50')
  })

  it('renders rationale text', () => {
    render(
      <RecommendationBanner decision="ship" rationale="Looks good." />
    )
    expect(screen.getByText('Looks good.')).toBeInTheDocument()
  })
})
