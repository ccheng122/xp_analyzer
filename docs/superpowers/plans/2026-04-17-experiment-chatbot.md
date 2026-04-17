# Experiment Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stateful AI chat panel to the results page so users can ask follow-up questions about their experiment; Claude answers from the results JSON and can run subgroup pandas analysis on the CSV when needed.

**Architecture:** A Next.js App Router route (`/api/chat`) uses the Vercel AI SDK with `@ai-sdk/anthropic` to stream Claude responses. A separate Python Flask function (`/api/subgroup`) performs groupby aggregations on the CSV. The `ChatPanel` React component uses `useChat` with a custom fetch that sends the CSV as multipart alongside the message history and experiment result.

**Tech Stack:** Vercel AI SDK v4 (`ai`, `@ai-sdk/anthropic`), Claude (`claude-sonnet-4-6`), `react-markdown`, `zod`, pandas (Python), Flask

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `web/api/subgroup.py` | Create | Python Flask function — groupby aggregation on CSV |
| `web/tests/test_subgroup.py` | Create | Pytest tests for subgroup endpoint |
| `web/app/api/chat/route.ts` | Create | Next.js streaming route — Claude + subgroup tool |
| `web/lib/__tests__/chat-prompt.test.ts` | Create | Unit tests for `buildSystemPrompt` |
| `web/components/report/ChatPanel.tsx` | Create | Chat UI — message history, input, streaming |
| `web/components/__tests__/ChatPanel.test.tsx` | Create | Vitest tests for ChatPanel |
| `web/components/report/ReportView.tsx` | Modify | Add `csvFile` prop, render `<ChatPanel>` |
| `web/components/__tests__/ReportView.test.tsx` | Modify | Pass `csvFile` to existing tests |
| `web/components/wizard/WizardShell.tsx` | Modify | Pass `csvFile` to `<ReportView>` |
| `web/requirements.txt` | Modify | Add `pandas` |
| `web/package.json` | Modify | Add `ai`, `@ai-sdk/anthropic`, `react-markdown`, `zod` |

---

### Task 1: Install dependencies and configure environment

**Files:**
- Modify: `web/package.json`
- Modify: `web/requirements.txt`
- Create: `web/.env.local` (gitignored)

- [ ] **Step 1: Install npm packages**

Run from `web/`:
```bash
npm install ai @ai-sdk/anthropic react-markdown zod
```

Expected: packages added to `node_modules/`, `package.json` updated with `ai`, `@ai-sdk/anthropic`, `react-markdown`, `zod` in `dependencies`.

- [ ] **Step 2: Add pandas to requirements.txt**

`web/requirements.txt` should now read:
```
flask>=3.0
pandas>=2.0
xp-analyzer @ git+https://github.com/ccheng122/xp_analyzer.git@master
```

- [ ] **Step 3: Create .env.local for local dev**

Create `web/.env.local` (already gitignored by `web/.gitignore`):
```
ANTHROPIC_API_KEY=your_key_here
```

- [ ] **Step 4: Verify .env.local is gitignored**

Run:
```bash
cat web/.gitignore | grep env
```
Expected output includes `.env*.local`

- [ ] **Step 5: Commit**

```bash
git add web/requirements.txt
git commit -m "chore(web): add pandas, ai sdk, react-markdown dependencies"
```

(Do NOT commit `.env.local` — it contains your API key.)

---

### Task 2: `/api/subgroup.py` + tests

**Files:**
- Create: `web/api/subgroup.py`
- Create: `web/tests/test_subgroup.py`

- [ ] **Step 1: Write the failing tests**

Create `web/tests/test_subgroup.py`:
```python
import pytest
import json
import sys
import os
from io import BytesIO

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from api.subgroup import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as c:
        yield c


CSV = (
    "group,value,other\n"
    "a,1.0,10\n"
    "a,2.0,20\n"
    "b,3.0,30\n"
    "b,4.0,40\n"
)


def test_subgroup_mean_returns_table(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'group',
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    assert 'table' in data
    assert 'a' in data['table']
    assert '1.5' in data['table']
    assert 'b' in data['table']
    assert '3.5' in data['table']


def test_subgroup_count(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'group',
            'metric_columns': json.dumps(['value']),
            'aggregation': 'count',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    assert '2' in data['table']


def test_subgroup_missing_csv(client):
    response = client.post(
        '/api/subgroup',
        data={
            'group_column': 'group',
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'error' in response.get_json()


def test_subgroup_missing_group_column(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'error' in response.get_json()


def test_subgroup_column_not_in_csv(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'nonexistent',
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'not found' in response.get_json()['error']


def test_subgroup_metric_column_not_in_csv(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'group',
            'metric_columns': json.dumps(['nonexistent']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'not found' in response.get_json()['error']
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `web/`:
```bash
python -m pytest tests/test_subgroup.py -v
```
Expected: `ModuleNotFoundError: No module named 'api.subgroup'`

- [ ] **Step 3: Implement `/api/subgroup.py`**

Create `web/api/subgroup.py`:
```python
import json
import io
import pandas as pd
from flask import Flask, request, jsonify

app = Flask(__name__)


def _df_to_markdown(df: pd.DataFrame) -> str:
    """Format a DataFrame as a markdown table."""
    index_name = df.index.name or 'group'
    cols = [index_name] + list(df.columns)
    header = '| ' + ' | '.join(str(c) for c in cols) + ' |'
    sep = '| ' + ' | '.join(['---'] * len(cols)) + ' |'
    rows = [
        '| ' + ' | '.join([str(idx)] + [str(v) for v in row]) + ' |'
        for idx, row in df.iterrows()
    ]
    return '\n'.join([header, sep] + rows)


@app.route('/api/subgroup', methods=['POST'])
def subgroup():
    if 'csv' not in request.files:
        return jsonify({'error': 'Missing csv file'}), 400

    group_column = request.form.get('group_column')
    metric_columns_raw = request.form.get('metric_columns')
    aggregation = request.form.get('aggregation', 'mean')

    if not group_column:
        return jsonify({'error': 'Missing group_column'}), 400
    if not metric_columns_raw:
        return jsonify({'error': 'Missing metric_columns'}), 400

    try:
        metric_columns = json.loads(metric_columns_raw)
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid metric_columns JSON'}), 400

    if aggregation not in ('mean', 'count', 'sum'):
        return jsonify({'error': "aggregation must be 'mean', 'count', or 'sum'"}), 400

    try:
        df = pd.read_csv(io.BytesIO(request.files['csv'].read()))
    except Exception as e:
        return jsonify({'error': f'Failed to read CSV: {str(e)}'}), 400

    if group_column not in df.columns:
        return jsonify({'error': f"Column '{group_column}' not found in CSV"}), 400

    missing = [c for c in metric_columns if c not in df.columns]
    if missing:
        return jsonify({'error': f"Columns not found in CSV: {', '.join(missing)}"}), 400

    if df[group_column].nunique() > 50:
        return jsonify({'error': f"Too many unique values in '{group_column}' (max 50)"}), 400

    grouped = df.groupby(group_column)[metric_columns].agg(aggregation).round(4)
    table = _df_to_markdown(grouped)

    return jsonify({'table': table})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_subgroup.py -v
```
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/api/subgroup.py web/tests/test_subgroup.py
git commit -m "feat(web): add /api/subgroup endpoint for CSV groupby analysis"
```

---

### Task 3: `/app/api/chat/route.ts` + prompt tests

**Files:**
- Create: `web/app/api/chat/route.ts`
- Create: `web/lib/__tests__/chat-prompt.test.ts`

- [ ] **Step 1: Write failing tests for buildSystemPrompt**

Create `web/lib/__tests__/chat-prompt.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/app/api/chat/route'
import type { ExperimentResult } from '@/lib/types'

const result: ExperimentResult = {
  experiment_name: 'Free to Plus',
  control_group: '0',
  treatment_groups: ['1'],
  total_users: 30000,
  metric_results: [
    {
      metric_name: 'paid_conversion',
      metric_type: 'binary',
      metric_role: 'primary',
      higher_is_better: true,
      control_mean: 0.0796,
      treatment_mean: 0.0966,
      relative_lift: 0.2136,
      absolute_lift: 0.017,
      p_value: 0.0000007,
      p_value_corrected: 0.0000007,
      confidence_interval_low: 0.010,
      confidence_interval_high: 0.024,
      effect_size: 1.21,
      is_significant: true,
      control_n: 20000,
      treatment_n: 10000,
    },
  ],
  findings: [
    {
      metric_name: 'paid_conversion',
      metric_role: 'primary',
      is_significant: true,
      direction: 'positive',
      summary: 'paid_conversion improved by +21.4%',
    },
  ],
  recommendation: {
    decision: 'ship',
    rationale: 'All primary metrics improved.',
    caveats: ['Monitor post-launch.'],
  },
}

describe('buildSystemPrompt', () => {
  it('includes experiment name', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('Free to Plus')
  })

  it('includes control and treatment groups', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('control_group: 0')
    expect(prompt).toContain('treatment_groups: 1')
  })

  it('includes metric name and role', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('paid_conversion')
    expect(prompt).toContain('primary')
  })

  it('includes recommendation decision', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('ship')
  })

  it('includes guideline about missing data', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain("wasn't in your CSV")
  })

  it('formats binary metric means as percentages', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('7.96%')
    expect(prompt).toContain('9.66%')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npm run test -- lib/__tests__/chat-prompt.test.ts
```
Expected: `Cannot find module '@/app/api/chat/route'`

- [ ] **Step 3: Create `web/app/api/chat/route.ts`**

Create directory `web/app/api/chat/` then create `route.ts`:

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import type { ExperimentResult, MetricResult } from '@/lib/types'

function formatMean(mean: number, type: string): string {
  return type === 'binary' ? `${(mean * 100).toFixed(2)}%` : mean.toFixed(4)
}

export function buildSystemPrompt(result: ExperimentResult): string {
  const metrics = result.metric_results
    .map((m: MetricResult) =>
      `  - ${m.metric_name} (${m.metric_role}, ${m.metric_type}): ` +
      `control=${formatMean(m.control_mean, m.metric_type)}, ` +
      `treatment=${formatMean(m.treatment_mean, m.metric_type)}, ` +
      `relative_lift=${(m.relative_lift * 100).toFixed(1)}%, ` +
      `p=${m.p_value.toFixed(6)}, ` +
      `significant=${m.is_significant}`
    )
    .join('\n')

  const findings = result.findings.map(f => `  - ${f.summary}`).join('\n')

  return `You are an expert data scientist analyzing A/B experiment results.

Experiment: ${result.experiment_name}
control_group: ${result.control_group}
treatment_groups: ${result.treatment_groups.join(', ')}
total_users: ${result.total_users.toLocaleString()}

Metric Results:
${metrics}

Findings:
${findings}

Recommendation: ${result.recommendation.decision} — ${result.recommendation.rationale}
Caveats: ${result.recommendation.caveats.join('; ')}

Guidelines:
- Answer from the results above when possible.
- Use the run_subgroup_analysis tool when the user asks about breakdowns by a column (e.g. day of week, platform, timezone).
- If a question requires data that is not in the results and cannot be derived from the CSV columns, explicitly say: "To answer that I'd need [specific data] which wasn't in your CSV."
- Never guess or hallucinate statistics. If uncertain, say so.
- Format responses clearly using markdown. Use tables for numeric comparisons.`
}

function getInternalApiUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:5001'
}

export async function POST(req: Request) {
  const formData = await req.formData()

  const messagesRaw = formData.get('messages')
  const resultRaw = formData.get('result')

  if (!messagesRaw || !resultRaw) {
    return new Response(JSON.stringify({ error: 'Missing messages or result' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const messages = JSON.parse(messagesRaw as string)
  const result: ExperimentResult = JSON.parse(resultRaw as string)
  const csvFile = formData.get('csv') as File | null

  const response = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: buildSystemPrompt(result),
    messages,
    maxSteps: 3,
    tools: {
      run_subgroup_analysis: tool({
        description:
          'Run a groupby aggregation on the experiment CSV to answer a subgroup question. Use when the user asks about breakdowns by a column.',
        parameters: z.object({
          group_column: z.string().describe('Column name to group by'),
          metric_columns: z.array(z.string()).describe('Column names to aggregate'),
          aggregation: z
            .enum(['mean', 'count', 'sum'])
            .describe('Aggregation function to apply'),
        }),
        execute: async ({ group_column, metric_columns, aggregation }) => {
          if (!csvFile) {
            return 'CSV is not available for subgroup analysis in this context.'
          }
          const subgroupForm = new FormData()
          subgroupForm.append('csv', csvFile)
          subgroupForm.append('group_column', group_column)
          subgroupForm.append('metric_columns', JSON.stringify(metric_columns))
          subgroupForm.append('aggregation', aggregation)
          let res: Response
          try {
            res = await fetch(`${getInternalApiUrl()}/api/subgroup`, {
              method: 'POST',
              body: subgroupForm,
            })
          } catch {
            return 'Subgroup analysis service is unavailable.'
          }
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }))
            return `Subgroup analysis failed: ${err.error}`
          }
          const data = await res.json()
          return data.table as string
        },
      }),
    },
  })

  return response.toDataStreamResponse()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npm run test -- lib/__tests__/chat-prompt.test.ts
```
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/chat/route.ts web/lib/__tests__/chat-prompt.test.ts
git commit -m "feat(web): add /api/chat streaming route with Claude and subgroup tool"
```

---

### Task 4: `ChatPanel.tsx` + tests

**Files:**
- Create: `web/components/report/ChatPanel.tsx`
- Create: `web/components/__tests__/ChatPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `web/components/__tests__/ChatPanel.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatPanel } from '../report/ChatPanel'
import type { ExperimentResult } from '@/lib/types'

// Mock the AI SDK useChat hook
vi.mock('ai/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    error: undefined,
  })),
}))

import { useChat } from 'ai/react'

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

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
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

  it('send button is enabled when input has text', () => {
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      input: 'What was the lift?',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: undefined,
    } as any)
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()
  })

  it('renders user and assistant messages', () => {
    vi.mocked(useChat).mockReturnValue({
      messages: [
        { id: '1', role: 'user', content: 'What was the lift?' },
        { id: '2', role: 'assistant', content: 'The lift was 21%.' },
      ],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: undefined,
    } as any)
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByText('What was the lift?')).toBeInTheDocument()
    expect(screen.getByText('The lift was 21%.')).toBeInTheDocument()
  })

  it('shows loading indicator when isLoading is true', () => {
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: true,
      error: undefined,
    } as any)
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByText(/thinking/i)).toBeInTheDocument()
  })

  it('shows error message when error is set', () => {
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: new Error('Network error'),
    } as any)
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('input is disabled while loading', () => {
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      input: 'hello',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: true,
      error: undefined,
    } as any)
    render(<ChatPanel result={result} csvFile={csvFile} />)
    expect(screen.getByPlaceholderText('Ask a follow-up question…')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npm run test -- components/__tests__/ChatPanel.test.tsx
```
Expected: `Cannot find module '../report/ChatPanel'`

- [ ] **Step 3: Implement `ChatPanel.tsx`**

Create `web/components/report/ChatPanel.tsx`:
```tsx
'use client'
import { useChat } from 'ai/react'
import ReactMarkdown from 'react-markdown'
import { useRef, useEffect } from 'react'
import type { ExperimentResult } from '@/lib/types'

interface Props {
  result: ExperimentResult
  csvFile: File
}

export function ChatPanel({ result, csvFile }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat',
    fetch: async (url, options) => {
      const body = JSON.parse((options?.body as string) ?? '{}')
      const formData = new FormData()
      formData.append('messages', JSON.stringify(body.messages))
      formData.append('result', JSON.stringify(result))
      formData.append('csv', csvFile)
      return fetch(url, { method: 'POST', body: formData })
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="border border-slate-200 rounded-xl bg-white flex flex-col" style={{ height: '480px' }}>
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Ask a question</h2>
        <p className="text-xs text-slate-400 mt-0.5">Ask follow-up questions about this experiment</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-xs text-slate-400 text-center mt-8">
            No messages yet. Ask a question below.
          </p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {m.role === 'assistant' ? (
                <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-table:text-xs">
                  {m.content}
                </ReactMarkdown>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-400">
              Thinking…
            </div>
          </div>
        )}
        {error && (
          <p className="text-xs text-red-500 text-center">
            Something went wrong. Please try again.
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="px-4 py-3 border-t border-slate-100 flex gap-2" onSubmit={handleSubmit}>
        <input
          className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="Ask a follow-up question…"
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-indigo-500 text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npm run test -- components/__tests__/ChatPanel.test.tsx
```
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/components/report/ChatPanel.tsx web/components/__tests__/ChatPanel.test.tsx
git commit -m "feat(web): add ChatPanel component with streaming chat UI"
```

---

### Task 5: Wire up ReportView and WizardShell

**Files:**
- Modify: `web/components/report/ReportView.tsx`
- Modify: `web/components/__tests__/ReportView.test.tsx`
- Modify: `web/components/wizard/WizardShell.tsx`

- [ ] **Step 1: Update ReportView to accept csvFile and render ChatPanel**

`web/components/report/ReportView.tsx` — full file:
```tsx
import type { ExperimentConfig, ExperimentResult } from '@/lib/types'
import { RecommendationBanner } from './RecommendationBanner'
import { StatsBar } from './StatsBar'
import { MetricCard } from './MetricCard'
import { CaveatsBlock } from './CaveatsBlock'
import { ChatPanel } from './ChatPanel'

interface Props {
  result: ExperimentResult
  config?: ExperimentConfig
  csvFile?: File
  onRunAnother: () => void
}

export function ReportView({ result, config, csvFile, onRunAnother }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <RecommendationBanner
        decision={result.recommendation.decision}
        rationale={result.recommendation.rationale}
      />

      {config && (
        <StatsBar
          totalUsers={result.total_users}
          metricCount={result.metric_results.length}
          significanceThreshold={config.significance_threshold}
          correctionMethod={config.correction_method}
        />
      )}

      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Metric Results
        </div>
        <div className="flex flex-col gap-3">
          {result.metric_results.map(r => (
            <MetricCard key={r.metric_name} result={r} />
          ))}
        </div>
      </div>

      <CaveatsBlock caveats={result.recommendation.caveats} />

      <div className="flex gap-3 pt-2">
        <button
          className="flex-1 border border-slate-200 bg-white text-slate-600 rounded-md py-2 text-sm hover:bg-slate-50"
          onClick={() => {
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${result.experiment_name.replace(/\s+/g, '_')}_result.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }}
        >
          ⬇ Download JSON
        </button>
        <button
          className="flex-1 border border-slate-200 bg-white text-slate-600 rounded-md py-2 text-sm hover:bg-slate-50"
          onClick={onRunAnother}
        >
          ← Run Another
        </button>
      </div>

      {csvFile && (
        <ChatPanel result={result} csvFile={csvFile} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update ReportView tests to suppress ChatPanel (mock useChat)**

`web/components/__tests__/ReportView.test.tsx` — add mock at top, before existing imports:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportView } from '../report/ReportView'
import type { ExperimentResult } from '@/lib/types'

// Prevent ChatPanel from making real API calls in tests
vi.mock('ai/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    error: undefined,
  })),
}))

// ... rest of file unchanged
```

- [ ] **Step 3: Run ReportView tests to verify they still pass**

```bash
cd web && npm run test -- components/__tests__/ReportView.test.tsx
```
Expected: all 5 existing tests PASS.

- [ ] **Step 4: Update WizardShell to pass csvFile to ReportView**

In `web/components/wizard/WizardShell.tsx`, find the step 5 block and add `csvFile`:

```tsx
{state.step === 5 && state.result && (
  <ReportView
    result={state.result}
    config={state.config as ExperimentConfig}
    csvFile={state.csv?.file}
    onRunAnother={() =>
      setState({ step: 1, csv: null, config: DEFAULT_CONFIG, result: null, error: null })
    }
  />
)}
```

- [ ] **Step 5: Run all tests**

```bash
cd web && npm run test
```
Expected: all tests PASS.

- [ ] **Step 6: Add ANTHROPIC_API_KEY to Vercel environment**

Run:
```bash
vercel env add ANTHROPIC_API_KEY production
```
Paste your API key when prompted.

- [ ] **Step 7: Commit and deploy**

```bash
git add web/components/report/ReportView.tsx \
        web/components/__tests__/ReportView.test.tsx \
        web/components/wizard/WizardShell.tsx
git commit -m "feat(web): wire ChatPanel into results page"
vercel --prod
```

---

## Manual Testing Checklist

After deploying, verify with the `free_plus_experiment.csv`:

- [ ] Complete wizard → reach results page → ChatPanel appears below metrics
- [ ] Ask: "What was the impact on paid plan signups?" — Claude answers from results JSON, no tool call
- [ ] Ask: "Did the treatment effect vary by assigned_on_platform?" — Claude calls `run_subgroup_analysis`, returns a breakdown table
- [ ] Ask: "What was the ROI?" — Claude reasons about it, notes assumptions
- [ ] Ask about a column not in the CSV — Claude explicitly says what data is missing
- [ ] Ask a follow-up like "now break that down by time_zone" — Claude remembers prior context
