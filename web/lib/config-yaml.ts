import type { ExperimentConfig } from './types'

export function configToYaml(config: ExperimentConfig): string {
  const lines: string[] = [
    `experiment_name: ${JSON.stringify(config.experiment_name)}`,
    `group_column: ${JSON.stringify(config.group_column)}`,
    `control_group: ${JSON.stringify(config.control_group)}`,
    `significance_threshold: ${config.significance_threshold}`,
    `correction_method: ${config.correction_method}`,
    `metrics:`,
  ]

  for (const metric of config.metrics) {
    lines.push(`  - name: ${JSON.stringify(metric.name)}`)
    lines.push(`    column: ${JSON.stringify(metric.column)}`)
    lines.push(`    type: ${metric.type}`)
    lines.push(`    role: ${metric.role}`)
    lines.push(`    higher_is_better: ${metric.higher_is_better}`)
    if (metric.derive) {
      lines.push(`    derive: ${metric.derive}`)
    }
    if (metric.filter_by) {
      lines.push(`    filter_by:`)
      lines.push(`      column: ${JSON.stringify(metric.filter_by.column)}`)
      lines.push(`      condition: ${metric.filter_by.condition}`)
    }
  }

  return lines.join('\n') + '\n'
}

export function downloadYaml(config: ExperimentConfig, filename = 'config.yaml'): void {
  const yaml = configToYaml(config)
  const blob = new Blob([yaml], { type: 'text/yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
