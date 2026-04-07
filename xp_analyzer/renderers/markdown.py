from datetime import date
from xp_analyzer.models import ExperimentResult, MetricResult, MetricRole


def _format_pct(value: float) -> str:
    return f"{value:+.1%}"


def _format_mean(value: float, metric_type: str) -> str:
    if metric_type == "binary":
        return f"{value:.1%}"
    return f"{value:.2f}"


def _significance_marker(result: MetricResult) -> str:
    return "Yes" if result.is_significant else "No"


def _render_metric_table(result: MetricResult) -> str:
    ctrl = _format_mean(result.control_mean, result.metric_type.value)
    trt = _format_mean(result.treatment_mean, result.metric_type.value)
    lift = _format_pct(result.relative_lift) if result.relative_lift != float("inf") else "+inf"
    ci = f"[{_format_pct(result.confidence_interval_low)}, {_format_pct(result.confidence_interval_high)}]"
    sig = _significance_marker(result)
    role_label = f"({result.metric_role.value})"

    lines = [
        f"### {result.metric_name} {role_label}",
        "",
        f"| Metric | Control | Treatment | Difference |",
        f"|--------|---------|-----------|------------|",
        f"| Mean | {ctrl} | {trt} | {lift} |",
        f"| p-value (corrected) | — | — | {result.p_value_corrected:.4f} |",
        f"| 95% CI (absolute) | — | — | {ci} |",
        f"| Statistically significant | — | — | {sig} |",
        f"| n | {result.control_n:,} | {result.treatment_n:,} | — |",
        "",
    ]
    return "\n".join(lines)


def render_markdown(result: ExperimentResult) -> str:
    decision_emoji = {
        "ship": "✓",
        "don't ship": "✗",
        "needs more data": "?",
        "inconclusive": "~",
        "review guardrail": "⚠",
    }
    emoji = decision_emoji.get(result.recommendation.decision, "")

    sections = [
        f"# Experiment Report: {result.experiment_name}",
        "",
        f"**Generated:** {date.today()}  ",
        f"**Control Group:** {result.control_group}  ",
        f"**Treatment Group(s):** {', '.join(result.treatment_groups)}  ",
        f"**Total Users:** {result.total_users:,}",
        "",
        "---",
        "",
        "## Summary",
        "",
        f"**Recommendation: {result.recommendation.decision.upper()} {emoji}**",
        "",
        result.recommendation.rationale,
        "",
        "---",
        "",
        "## Results",
        "",
    ]

    for metric_result in result.metric_results:
        sections.append(_render_metric_table(metric_result))

    sections += [
        "---",
        "",
        "## Findings",
        "",
    ]
    for i, finding in enumerate(result.findings, start=1):
        sections.append(f"{i}. {finding.summary}")
    sections.append("")

    sections += [
        "---",
        "",
        "## Recommendation",
        "",
        f"**Decision: {result.recommendation.decision.upper()}**",
        "",
        f"**Rationale:** {result.recommendation.rationale}",
        "",
    ]
    if result.recommendation.caveats:
        sections.append("**Caveats:**")
        for caveat in result.recommendation.caveats:
            sections.append(f"- {caveat}")
        sections.append("")

    return "\n".join(sections)
