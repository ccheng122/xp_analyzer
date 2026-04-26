import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatBubble } from '../ChatBubble'

describe('ChatBubble', () => {
  it('renders children', () => {
    render(<ChatBubble role="user">Hello there</ChatBubble>)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('aligns user to the right with a bg-page bubble', () => {
    render(<ChatBubble role="user">x</ChatBubble>)
    const root = screen.getByTestId('ui-chat-bubble')
    expect(root).toHaveAttribute('data-role', 'user')
    expect(root).toHaveClass('justify-end')
    expect(root.children[0]).toHaveClass('bg-page', 'rounded-card')
  })

  it('aligns assistant to the left with no bg', () => {
    render(<ChatBubble role="assistant">x</ChatBubble>)
    const root = screen.getByTestId('ui-chat-bubble')
    expect(root).toHaveAttribute('data-role', 'assistant')
    expect(root).toHaveClass('justify-start')
    const inner = root.children[0] as HTMLElement
    expect(inner.className).not.toMatch(/bg-/)
  })

  it('caps user bubble at 80% width', () => {
    render(<ChatBubble role="user">x</ChatBubble>)
    const root = screen.getByTestId('ui-chat-bubble')
    expect(root.children[0]).toHaveClass('max-w-[80%]')
  })

  it('caps assistant content at 90% width', () => {
    render(<ChatBubble role="assistant">x</ChatBubble>)
    const root = screen.getByTestId('ui-chat-bubble')
    expect(root.children[0]).toHaveClass('max-w-[90%]')
  })

  it('uses body text tokens for both roles', () => {
    const { rerender } = render(<ChatBubble role="user">x</ChatBubble>)
    expect(screen.getByTestId('ui-chat-bubble').children[0]).toHaveClass('text-body', 'leading-body')
    rerender(<ChatBubble role="assistant">x</ChatBubble>)
    expect(screen.getByTestId('ui-chat-bubble').children[0]).toHaveClass('text-body', 'leading-body')
  })
})
