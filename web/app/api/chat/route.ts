import { anthropic } from '@ai-sdk/anthropic'
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai'
import type { UIMessage } from 'ai'
import { z } from 'zod'
import type { ExperimentResult, MetricResult } from '@/lib/types'

function formatMean(mean: number, type: string): string {
  return type === 'binary' ? `${(mean * 100).toFixed(2)}%` : mean.toFixed(4)
}

export function buildSystemPrompt(result: ExperimentResult): string {
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

Guidelines:
- Answer from the results above when possible.
- Use the run_subgroup_analysis tool when the user asks about breakdowns by a column (e.g. day of week, platform, timezone).
- If a question requires data that is not in the results and cannot be derived from the CSV columns, explicitly say: "To answer that I'd need [specific data] which wasn't in your CSV."
- Never guess or hallucinate statistics. If uncertain, say so.
- Format responses clearly using markdown. Use tables for numeric comparisons.`
}

function getInternalApiUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  // In development, route handlers run server-side and bypass Next.js rewrites,
  // so we call Flask directly rather than going through the dev proxy.
  return process.env.FLASK_URL ?? 'http://localhost:5001'
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
  const csvFile = formData.get('csv') as File | null

  const response = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: buildSystemPrompt(result),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(3),
    tools: {
      run_subgroup_analysis: tool({
        description:
          'Run a groupby aggregation on the experiment CSV to answer a subgroup question. Use when the user asks about breakdowns by a column.',
        inputSchema: z.object({
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
          if (typeof data.table !== 'string') {
            return 'Subgroup analysis returned an unexpected response.'
          }
          return data.table
        },
      }),
    },
  })

  return response.toUIMessageStreamResponse()
}
