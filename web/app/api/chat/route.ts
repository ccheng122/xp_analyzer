import { anthropic } from '@ai-sdk/anthropic'
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai'
import type { UIMessage } from 'ai'
import { z } from 'zod'
import type { ExperimentConfig, ExperimentResult, MetricResult } from '@/lib/types'

function formatMean(mean: number, type: string): string {
  return type === 'binary' ? `${(mean * 100).toFixed(2)}%` : mean.toFixed(4)
}

export function buildSystemPrompt(result: ExperimentResult, csvColumns?: string[], config?: ExperimentConfig): string {
  const metrics = result.metric_results
    .map((m: MetricResult) =>
      `  - ${m.metric_name} (${m.metric_role}, ${m.metric_type}): ` +
      `control=${formatMean(m.control_mean, m.metric_type)} (n=${m.control_n.toLocaleString()}), ` +
      `treatment=${formatMean(m.treatment_mean, m.metric_type)} (n=${m.treatment_n.toLocaleString()}), ` +
      `relative_lift=${(m.relative_lift * 100).toFixed(1)}%, ` +
      `absolute_lift=${(m.absolute_lift * 100).toFixed(2)}pp, ` +
      `p=${m.p_value.toFixed(6)}${m.p_value_corrected != null ? ` (corrected: ${m.p_value_corrected.toFixed(6)})` : ''}, ` +
      `CI=[${(m.confidence_interval_low * 100).toFixed(2)}pp, ${(m.confidence_interval_high * 100).toFixed(2)}pp], ` +
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

CSV columns available for subgroup analysis: ${csvColumns && csvColumns.length > 0 ? csvColumns.join(', ') : 'unknown (CSV not provided)'}
${config?.metrics ? `
Metric → CSV column mapping (IMPORTANT: use CSV column names, not metric names, in subgroup analysis):
${config.metrics.map(m => `  - metric "${m.name}" → CSV column "${m.column}"${m.derive === 'not_null' ? ` (derived: 1 if ${m.column} is not null, 0 otherwise — use aggregation "not_null_rate" on "${m.column}")` : ''}`).join('\n')}` : ''}

Guidelines:
- Answer from the results above when possible.
- Use the run_subgroup_analysis tool when the user asks about breakdowns by a column.
- For date columns, you can derive day-of-week, week, month, or year — pass dayofweek(col), week(col), month(col), or year(col) as the group_column.
- For multi-dimensional breakdowns (e.g. treatment effect by day of week), pass an array of column names as group_column, like ["treatment", "dayofweek(assignment_date)"]. This returns a single cross-tab so you can compute lift per bucket without multiple calls.
- When the user asks whether the *effect* differs by a dimension ("is there a day-of-week effect?", "does the lift vary by tenure?"), use run_interaction_test. It fits a regression with the treatment × breakdown interaction and returns a single joint p-value plus per-bucket descriptive lift. run_subgroup_analysis gives per-bucket *rates*; run_interaction_test gives the *test* of whether the bucket-level differences are real signal vs. sampling noise.
- If a question requires data not in the results and not derivable from the CSV columns above, say: "To answer that I'd need [specific data] which wasn't in your CSV."
- Never guess or hallucinate statistics. If uncertain, say so.
- Format responses clearly using markdown. Use tables for numeric comparisons.`
}

function getSubgroupUrl(): string {
  // Explicit override always wins (local dev or custom deploy)
  if (process.env.FLASK_SUBGROUP_URL) return `${process.env.FLASK_SUBGROUP_URL}/api/subgroup`
  // Prefer the production alias (unprotected) over VERCEL_URL — the deployment-
  // specific hostname is gated by Vercel Deployment Protection and 401s on
  // internal function-to-function fetches. See docs/ARCHITECTURE_DECISIONS.md.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/subgroup`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/subgroup`
  // Fallback for local dev without explicit config
  const base = process.env.FLASK_URL ?? 'http://localhost:5002'
  return `${base}/api/subgroup`
}

function getInteractionUrl(): string {
  if (process.env.FLASK_INTERACTION_URL) return `${process.env.FLASK_INTERACTION_URL}/api/interaction`
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/interaction`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/interaction`
  return 'http://localhost:5003/api/interaction'
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

  let messages: UIMessage[]
  let result: ExperimentResult
  try {
    messages = JSON.parse(messagesRaw as string) as UIMessage[]
    result = JSON.parse(resultRaw as string) as ExperimentResult
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in messages or result' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const configRaw = formData.get('config')
  let config: ExperimentConfig | undefined
  if (configRaw) {
    try { config = JSON.parse(configRaw as string) as ExperimentConfig } catch { /* optional */ }
  }
  const csvFile = formData.get('csv') as File | null

  let csvColumns: string[] = []
  if (csvFile) {
    try {
      const firstLine = (await csvFile.text()).split('\n')[0]
      csvColumns = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    } catch {
      // non-fatal — system prompt will say columns are unknown
    }
  }

  const response = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: buildSystemPrompt(result, csvColumns, config),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(3),
    tools: {
      run_subgroup_analysis: tool({
        description:
          'Run a groupby aggregation on the experiment CSV to answer a subgroup question. Use when the user asks about breakdowns by a column.',
        inputSchema: z.object({
          group_column: z
            .union([z.string(), z.array(z.string()).min(1)])
            .describe(
              'Column to group by. Pass a string for a single dimension (e.g. "treatment" or "dayofweek(date)"), or an array for multi-dimensional cross-tabs (e.g. ["treatment", "dayofweek(date)"]).',
            ),
          metric_columns: z.array(z.string()).describe('Column names to aggregate'),
          aggregation: z
            .enum(['mean', 'count', 'sum', 'not_null_rate'])
            .describe('Aggregation function. Use not_null_rate for derived metrics based on not_null.'),
        }),
        execute: async ({ group_column, metric_columns, aggregation }) => {
          if (!csvFile) {
            return 'CSV is not available for subgroup analysis in this context.'
          }
          const subgroupForm = new FormData()
          subgroupForm.append('csv', csvFile)
          subgroupForm.append(
            'group_column',
            Array.isArray(group_column) ? JSON.stringify(group_column) : group_column,
          )
          subgroupForm.append('metric_columns', JSON.stringify(metric_columns))
          subgroupForm.append('aggregation', aggregation)
          let res: Response
          try {
            res = await fetch(getSubgroupUrl(), {
              method: 'POST',
              body: subgroupForm,
            })
          } catch {
            return 'Subgroup analysis service is unavailable.'
          }
          if (!res.ok) {
            const text = await res.text()
            try {
              const err = JSON.parse(text) as { error?: string }
              return `Subgroup analysis failed: ${err.error ?? text.slice(0, 200)}`
            } catch {
              return `Subgroup analysis failed (${res.status}): ${text.slice(0, 200)}`
            }
          }
          const data = await res.json()
          if (typeof data.table !== 'string') {
            return 'Subgroup analysis returned an unexpected response.'
          }
          return data.table
        },
      }),
      run_interaction_test: tool({
        description:
          "Test whether the treatment effect varies across a breakdown dimension (e.g. 'is the day-of-week effect real?'). Fits a regression with treatment × breakdown interaction terms and returns a joint Wald p-value plus per-bucket descriptive lift. Use when the user asks whether an effect *differs* by a dimension — not for plain per-bucket rate breakdowns (use run_subgroup_analysis for those).",
        inputSchema: z.object({
          metric_column: z
            .string()
            .describe(
              "CSV column for the outcome. For derived not_null binary metrics, pass the underlying column (e.g., 'paid_signup_date') with metric_type='binary'.",
            ),
          treatment_column: z.string().describe('CSV column with the treatment indicator.'),
          breakdown_column: z
            .string()
            .describe(
              "CSV column or date derivation for the breakdown dimension (e.g., 'dayofweek(assignment_date)').",
            ),
          metric_type: z
            .enum(['binary', 'continuous'])
            .describe('binary uses logistic regression; continuous uses OLS.'),
          control_value: z
            .string()
            .optional()
            .describe("Value of treatment_column representing control (default '0')."),
        }),
        execute: async ({
          metric_column,
          treatment_column,
          breakdown_column,
          metric_type,
          control_value,
        }) => {
          if (!csvFile) {
            return 'CSV is not available for interaction test in this context.'
          }
          const form = new FormData()
          form.append('csv', csvFile)
          form.append('metric_column', metric_column)
          form.append('treatment_column', treatment_column)
          form.append('breakdown_column', breakdown_column)
          form.append('metric_type', metric_type)
          if (control_value) form.append('control_value', control_value)
          let res: Response
          try {
            res = await fetch(getInteractionUrl(), { method: 'POST', body: form })
          } catch {
            return 'Interaction test service is unavailable.'
          }
          if (!res.ok) {
            const text = await res.text()
            try {
              const err = JSON.parse(text) as { error?: string }
              return `Interaction test failed: ${err.error ?? text.slice(0, 200)}`
            } catch {
              return `Interaction test failed (${res.status}): ${text.slice(0, 200)}`
            }
          }
          const data = await res.json()
          if (typeof data.summary !== 'string') {
            return 'Interaction test returned an unexpected response.'
          }
          return data.summary
        },
      }),
    },
  })

  return response.toUIMessageStreamResponse()
}
