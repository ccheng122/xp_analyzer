'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import type {
  Decision,
  ExperimentConfig,
  ExperimentResult,
  MetricResult,
  MetricRole,
} from '@/lib/types'
import {
  Card,
  ChatBubble,
  DiagnosticRow,
  MetricCard,
  SuggestedChip,
  VerdictBanner,
} from '@/components/ui'

interface Props {
  result: ExperimentResult
  config?: ExperimentConfig
  csvFile?: File
  onRunAnother: () => void
}

const SUGGESTED_PROMPTS = [
  'Why is the lift what it is?',
  'Should I run this longer?',
  'Is the day-of-week imbalance a concern?',
]

function decisionTone(decision: Decision): 'success' | 'danger' | 'neutral' {
  if (decision === 'ship') return 'success'
  if (decision === "don't ship" || decision === 'review guardrail') return 'danger'
  return 'neutral'
}

function decisionTitle(decision: Decision): string {
  switch (decision) {
    case 'ship':
      return 'Ship'
    case "don't ship":
      return "Don't ship"
    case 'review guardrail':
      return 'Review guardrail'
    case 'needs more data':
      return 'Needs more data'
    case 'inconclusive':
      return 'Inconclusive'
  }
}

function metricKind(role: MetricRole): 'primary' | 'guardrail' {
  return role === 'guardrail' ? 'guardrail' : 'primary'
}

function metricDescription(r: MetricResult): string {
  return `${r.metric_type} · ${r.higher_is_better ? 'higher is better' : 'lower is better'}`
}

function isMetricViolation(r: MetricResult): boolean {
  if (!r.is_significant || r.metric_role !== 'guardrail') return false
  return r.higher_is_better ? r.relative_lift < 0 : r.relative_lift > 0
}

function downloadJson(result: ExperimentResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${result.experiment_name.replace(/\s+/g, '_')}_result.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ReportViewV2({ result, config, csvFile, onRunAnother }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: async (url: RequestInfo | URL, options?: RequestInit) => {
        if (!csvFile) {
          return new Response(JSON.stringify({ error: 'CSV file required' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
        }
        const body = JSON.parse((options?.body as string) ?? '{}') as { messages?: unknown }
        const formData = new FormData()
        formData.append('messages', JSON.stringify(body.messages))
        formData.append('result', JSON.stringify(result))
        if (config) formData.append('config', JSON.stringify(config))
        formData.append('csv', csvFile)
        return fetch(url, { method: 'POST', body: formData })
      },
    }),
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    void sendMessage({ text })
  }

  function handleSuggested(prompt: string) {
    if (isLoading) return
    void sendMessage({ text: prompt })
  }

  return (
    <div data-testid="report-view-v2" className="bg-page p-4 rounded-card">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="text-section leading-tight font-medium text-text truncate">
            {result.experiment_name}
          </div>
          <div className="text-meta leading-tight text-muted mt-0.5">
            {result.total_users.toLocaleString()} users · {result.metric_results.length} metrics
            {config && ` · α=${config.significance_threshold} · ${config.correction_method}`}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => downloadJson(result)}
            className="bg-surface border border-border text-text text-body leading-tight rounded-control px-3 py-2 hover:bg-surface-subtle cursor-pointer"
          >
            Download
          </button>
          <button
            type="button"
            onClick={onRunAnother}
            className="bg-surface border border-border text-text text-body leading-tight rounded-control px-3 py-2 hover:bg-surface-subtle cursor-pointer"
          >
            Run another
          </button>
        </div>
      </header>

      <div
        data-testid="report-grid"
        className="grid gap-3"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)' }}
      >
        <div data-testid="report-left" className="flex flex-col gap-2.5 min-w-0">
          <VerdictBanner
            tone={decisionTone(result.recommendation.decision)}
            title={decisionTitle(result.recommendation.decision)}
            body={result.recommendation.rationale}
          />

          {result.metric_results.map((r) => (
            <MetricCard
              key={r.metric_name}
              name={r.metric_name}
              kind={metricKind(r.metric_role)}
              description={metricDescription(r)}
              controlRate={r.control_mean}
              treatmentRate={r.treatment_mean}
              relativeLift={r.relative_lift}
              pValue={r.p_value_corrected ?? r.p_value}
              ciLower={r.confidence_interval_low}
              ciUpper={r.confidence_interval_high}
              direction={r.higher_is_better ? 'higher-is-better' : 'lower-is-better'}
              isSignificant={r.is_significant}
              isViolation={isMetricViolation(r)}
            />
          ))}

          <Card>
            <div className="text-section leading-tight font-medium text-text mb-2">
              Diagnostics
            </div>
            <DiagnosticRow label="Sample ratio (SRM)" status="pass" />
            <DiagnosticRow label="Novelty effect" status="pass" />
            <DiagnosticRow label="Day-of-week balance" status="flag" />
            <DiagnosticRow label="Tenure split" status="not-run" />
          </Card>
        </div>

        <div
          data-testid="report-right"
          className="bg-surface border border-border rounded-card flex flex-col min-h-[520px] min-w-0"
        >
          <div className="px-card-x py-card-y border-b border-border">
            <div className="text-section leading-tight font-medium text-text">
              Ask about these results
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto px-card-x py-card-y space-y-3"
            data-testid="chat-messages"
          >
            {messages.map((m: UIMessage) => {
              if (m.role !== 'user' && m.role !== 'assistant') return null
              const text = m.parts
                .filter((p) => p.type === 'text')
                .map((p) => (p as { type: 'text'; text: string }).text)
                .join('')
              return (
                <ChatBubble key={m.id} role={m.role}>
                  {m.role === 'assistant' ? <ReactMarkdown>{text}</ReactMarkdown> : <p>{text}</p>}
                </ChatBubble>
              )
            })}
            {isLoading && (
              <div className="text-meta leading-tight text-muted italic">Thinking…</div>
            )}
            {error && (
              <div className="text-meta leading-tight text-danger">
                Something went wrong. Please try again.
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-card-x pt-2 flex gap-2 flex-wrap">
            {SUGGESTED_PROMPTS.map((p) => (
              <SuggestedChip key={p} label={p} onClick={() => handleSuggested(p)} />
            ))}
          </div>

          <form onSubmit={handleSubmit} className="px-card-x py-card-y flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about these results…"
              disabled={isLoading}
              className="flex-1 bg-surface border border-border rounded-control px-3 py-2 text-body leading-tight text-text placeholder:text-muted focus:outline-none focus:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-text text-white text-body leading-tight font-medium rounded-control px-4 py-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
