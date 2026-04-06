from xp_analyzer.models import MetricResult, MetricRole, Finding, Recommendation


def _is_improvement(relative_lift: float, higher_is_better: bool) -> bool:
    if relative_lift == float("inf"):
        return higher_is_better
    if higher_is_better:
        return relative_lift > 0
    return relative_lift < 0


def _format_lift(relative_lift: float) -> str:
    if relative_lift == float("inf"):
        return "+inf"
    return f"{relative_lift:+.1%}"


def generate_findings(metric_results: list[MetricResult]) -> list[Finding]:
    findings = []
    for r in metric_results:
        lift_str = _format_lift(r.relative_lift)
        if not r.is_significant:
            direction = "neutral"
            summary = (
                f"{r.metric_name} showed no statistically significant change "
                f"(p={r.p_value_corrected:.3f}, lift={lift_str})."
            )
        elif _is_improvement(r.relative_lift, r.higher_is_better):
            direction = "positive"
            summary = (
                f"{r.metric_name} improved by {lift_str} "
                f"(p={r.p_value_corrected:.3f}), a statistically significant win."
            )
        else:
            direction = "negative"
            label = "guardrail violation" if r.metric_role == MetricRole.GUARDRAIL else "regression"
            summary = (
                f"{r.metric_name} worsened by {lift_str} "
                f"(p={r.p_value_corrected:.3f}) — {label}."
            )
        findings.append(Finding(
            metric_name=r.metric_name,
            metric_role=r.metric_role,
            is_significant=r.is_significant,
            direction=direction,
            summary=summary,
        ))
    return findings


def generate_recommendation(findings: list[Finding]) -> Recommendation:
    guardrail_violations = [
        f for f in findings
        if f.metric_role == MetricRole.GUARDRAIL and f.is_significant and f.direction == "negative"
    ]
    primary_findings = [f for f in findings if f.metric_role == MetricRole.PRIMARY]
    significant_primary = [f for f in primary_findings if f.is_significant]
    positive_primary = [f for f in significant_primary if f.direction == "positive"]
    negative_primary = [f for f in significant_primary if f.direction == "negative"]

    if guardrail_violations:
        violated = ", ".join(f.metric_name for f in guardrail_violations)
        return Recommendation(
            decision="don't ship",
            rationale=f"Guardrail violation(s) detected: {violated}. Do not ship until resolved.",
            caveats=["Investigate the guardrail regression before proceeding."],
        )

    if not significant_primary:
        return Recommendation(
            decision="needs more data",
            rationale="No primary metrics reached statistical significance. The experiment may be underpowered.",
            caveats=["Consider running longer or increasing sample size."],
        )

    if negative_primary and positive_primary:
        return Recommendation(
            decision="inconclusive",
            rationale="Primary metrics showed mixed results — some improved, some worsened.",
            caveats=["Review individual metric findings before deciding."],
        )

    if negative_primary:
        return Recommendation(
            decision="don't ship",
            rationale="Primary metrics showed statistically significant regressions.",
            caveats=["Review the negative findings before iterating."],
        )

    return Recommendation(
        decision="ship",
        rationale="All primary metrics improved with statistical significance and no guardrails were violated.",
        caveats=["Monitor metrics post-launch to confirm results hold at scale."],
    )
