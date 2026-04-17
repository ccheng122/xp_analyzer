import { anthropic } from '@ai-sdk/anthropic'
import { streamText, tool, stepCountIs } from 'ai'
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
          return data.table as string
        },
      }),
    },
  })

  return response.toTextStreamResponse()
}
