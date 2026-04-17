# Experiment Chatbot Design

## Goal

Add a stateful AI chat panel to the results page where analysts and stakeholders can ask follow-up questions about the experiment. The chatbot uses Claude (Anthropic API) and can answer from the results JSON directly or run subgroup analysis against the raw CSV when the question requires it.

## Architecture

**Frontend:** A `ChatPanel` React component rendered below the report cards on the results page. Uses the Vercel AI SDK's `useChat` hook for streaming, message history, and loading state. Receives `result: ExperimentResult` and `csvFile: File` as props from `WizardShell`.

**Chat API route:** `POST /api/chat` — a Next.js App Router route handler using `@ai-sdk/anthropic` and the AI SDK's `streamText`. Receives: message history, experiment result JSON, and the CSV file (multipart). Builds a system prompt from the results and streams Claude's response back.

**Subgroup API:** `POST /api/subgroup` — a new Python Flask serverless function. Accepts a CSV file and a JSON description of the grouping/aggregation to perform. Returns a plain-text summary table. Called by `/api/chat` as a Claude tool when raw data analysis is needed.

## Data Flow

1. User reaches the results page — `ChatPanel` mounts with `result` and `csvFile` from `WizardShell` state.
2. User sends a message — `useChat` POSTs to `/api/chat` with message history + result JSON in the body + CSV as a multipart file field.
3. `/api/chat` constructs a system prompt containing the experiment name, config summary, all metric results (means, lifts, p-values, CIs), findings, and recommendation.
4. Claude answers directly if possible (most questions from the results JSON).
5. If Claude needs subgroup data, it calls the `run_subgroup_analysis` tool with `{ column: string, metrics: string[] }`. The route POSTs to `/api/subgroup` with the CSV + params, gets back a text table, and feeds it back to Claude as the tool result.
6. Claude's response streams to the browser and renders as markdown.

## Components and Files

**New files:**
- `web/components/report/ChatPanel.tsx` — chat UI: scrollable message history, markdown rendering, input + send button, loading state
- `web/app/api/chat/route.ts` — Next.js route handler using Vercel AI SDK `streamText` with Claude
- `web/api/subgroup.py` — Flask serverless function for subgroup/aggregation analysis

**Modified files:**
- `web/components/report/ReportView.tsx` — add `csvFile: File` prop, render `<ChatPanel>` below existing content
- `web/components/wizard/WizardShell.tsx` — pass `csvFile={state.csv.file}` to `ReportView`
- `web/lib/types.ts` — no changes needed
- `web/package.json` — add `ai`, `@ai-sdk/anthropic`, `react-markdown`

## System Prompt

```
You are an expert data scientist helping analyze A/B experiment results.

Experiment: {experiment_name}
Control group: {control_group}
Treatment groups: {treatment_groups}
Total users: {total_users}
Significance threshold: {significance_threshold} ({correction_method} correction)

Metric Results:
{for each metric: name, role, type, control mean, treatment mean, relative lift, p-value, CI, significant}

Findings:
{findings summaries}

Recommendation: {decision} — {rationale}
Caveats: {caveats}

Guidelines:
- Answer from the results above when possible.
- If a question requires raw data analysis (subgroups, segments, day-of-week breakdowns), use the run_subgroup_analysis tool.
- If a question requires data that is not in the results and cannot be derived from the CSV columns available, explicitly say: "To answer that I'd need [specific data] which wasn't in your CSV."
- Never guess or hallucinate statistics. If uncertain, say so.
- Format responses clearly using markdown. Use tables for comparisons.
```

## Subgroup Tool

Claude calls this tool when it needs raw data:

```typescript
tool({
  description: 'Run a groupby aggregation on the experiment CSV to answer a subgroup question',
  parameters: z.object({
    group_column: z.string().describe('Column to group by'),
    metric_columns: z.array(z.string()).describe('Columns to aggregate'),
    aggregation: z.enum(['mean', 'count', 'sum']).describe('Aggregation function'),
  }),
  execute: async ({ group_column, metric_columns, aggregation }) => {
    // POST to /api/subgroup with CSV + params
    // Returns plain-text summary table
  }
})
```

## `/api/subgroup.py`

Accepts `csv` (file) + `group_column`, `metric_columns` (JSON array), `aggregation` as form fields. Uses pandas to group and aggregate. Returns a plain-text markdown table. Caps at 50 groups to prevent abuse.

## Error Handling

- **Claude can't answer from results + subgroup tool fails:** Claude responds "I don't have enough information to answer that" with a specific explanation of what data is missing.
- **Missing column in CSV:** `/api/subgroup` returns a 400 with the column name; Claude surfaces this as "That column wasn't found in your CSV."
- **`/api/chat` route error (network, API key, etc.):** `ChatPanel` shows an inline error below the input without breaking the rest of the page.
- **CSV not included in request:** Claude skips the tool and explicitly tells the user it can't do subgroup analysis in this context.

## CSV Handling

The CSV `File` object is already in browser memory from step 1 of the wizard. It is silently included in each `/api/chat` request as a multipart file field — no second upload prompt shown to the user.

## Conversation Statefulness

Full message history is maintained client-side by `useChat` and sent with every request. Claude sees the entire conversation on each turn, enabling natural follow-ups like "now break that down by timezone."

## Dependencies

- `ai` — Vercel AI SDK core
- `@ai-sdk/anthropic` — Claude provider for AI SDK
- `react-markdown` — render assistant messages as markdown
- `zod` — tool parameter schema validation (already used in AI SDK patterns)
- `ANTHROPIC_API_KEY` — environment variable required in Vercel project settings
