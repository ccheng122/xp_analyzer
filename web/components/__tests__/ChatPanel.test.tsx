import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatPanel } from '../report/ChatPanel'
import type { ExperimentResult } from '@/lib/types'

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: vi.fn(),
    status: 'ready',
    error: undefined,
  })),
}))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    DefaultChatTransport: vi.fn().mockImplementation(function () {
      return {}
    }),
  }
})

import { useChat } from '@ai-sdk/react'

const result: ExperimentResult = {
  experiment_name: 'Test',
  control_group: '0',
  treatment_groups: ['1'],
  total_users: 1000,
  metric_results: [],
  findings: [],
  recommendation: { decision: 'ship', rationale: 'Good.', caveats: [] },
}

const csvFile = new File(['col\n1\n2'], 'data.csv', { type: 'text/csv' })

function makeMessage(id: string, role: 'user' | 'assistant', text: string) {
  return { id, role, parts: [{ type: 'text' as const, text }] }
}

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      status: 'ready',
      error: undefined,
    } as any)
  })

  it('renders the input and send button', () => {
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByPlaceholderText('Ask a follow-up question…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('send button is enabled when input has text', async () => {
    const user = userEvent.setup()
    render(<ChatPanel result={result} csvFile={csvFile} />)
    await user.type(screen.getByPlaceholderText('Ask a follow-up question…'), 'What was the lift?')
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()
  })

  it('renders user and assistant messages', () => {
    vi.mocked(useChat).mockReturnValue({
      messages: [
        makeMessage('1', 'user', 'What was the lift?'),
        makeMessage('2', 'assistant', 'The lift was 21%.'),
      ],
      sendMessage: vi.fn(),
      status: 'ready',
      error: undefined,
    } as any)
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByText('What was the lift?')).toBeInTheDocument()
    expect(screen.getByText('The lift was 21%.')).toBeInTheDocument()
  })

  it('shows loading indicator when isLoading is true', () => {
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      status: 'streaming',
      error: undefined,
    } as any)
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByText(/thinking/i)).toBeInTheDocument()
  })

  it('shows error message when error is set', () => {
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      status: 'ready',
      error: new Error('Network error'),
    } as any)
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('input is disabled while loading', () => {
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      status: 'submitted',
      error: undefined,
    } as any)
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByPlaceholderText('Ask a follow-up question…')).toBeDisabled()
  })
})
