import pytest
from xp_analyzer.findings import generate_findings, generate_recommendation
from xp_analyzer.models import MetricResult, MetricType, MetricRole, Finding


def make_result(name, role, is_significant, relative_lift, higher_is_better=True, p_value=0.01):
    return MetricResult(
        metric_name=name,
        metric_type=MetricType.BINARY,
        metric_role=role,
        higher_is_better=higher_is_better,
        control_mean=0.1,
        treatment_mean=0.1 * (1 + relative_lift) if relative_lift != float("inf") else 0.2,
        relative_lift=relative_lift,
        absolute_lift=0.1 * relative_lift if relative_lift != float("inf") else 0.1,
        p_value=p_value,
        p_value_corrected=p_value,
        confidence_interval_low=-0.01,
        confidence_interval_high=0.05,
        effect_size=0.2,
        is_significant=is_significant,
        control_n=1000,
        treatment_n=1000,
    )


# --- generate_findings ---

def test_significant_positive_primary_is_positive():
    results = [make_result("conversion", MetricRole.PRIMARY, True, 0.15)]
    findings = generate_findings(results)
    assert findings[0].direction == "positive"
    assert findings[0].is_significant is True


def test_not_significant_is_neutral():
    results = [make_result("conversion", MetricRole.PRIMARY, False, 0.02, p_value=0.4)]
    findings = generate_findings(results)
    assert findings[0].direction == "neutral"


def test_guardrail_positive_lift_lower_is_better_is_negative():
    # refund_rate went UP (lift=+0.30) — bad because higher_is_better=False
    results = [make_result("refund_rate", MetricRole.GUARDRAIL, True, 0.30, higher_is_better=False)]
    findings = generate_findings(results)
    assert findings[0].direction == "negative"


def test_guardrail_negative_lift_lower_is_better_is_positive():
    # refund_rate went DOWN (lift=-0.20) — good because higher_is_better=False
    results = [make_result("refund_rate", MetricRole.GUARDRAIL, True, -0.20, higher_is_better=False)]
    findings = generate_findings(results)
    assert findings[0].direction == "positive"


def test_finding_summary_is_non_empty_string():
    results = [make_result("conversion", MetricRole.PRIMARY, True, 0.15)]
    findings = generate_findings(results)
    assert isinstance(findings[0].summary, str)
    assert len(findings[0].summary) > 0


# --- generate_recommendation ---

def test_ship_when_all_primary_win_no_guardrail_violation():
    findings = [
        Finding("conversion", MetricRole.PRIMARY, is_significant=True, direction="positive", summary="win"),
    ]
    rec = generate_recommendation(findings)
    assert rec.decision == "ship"


def test_no_ship_when_guardrail_violated():
    findings = [
        Finding("conversion", MetricRole.PRIMARY, is_significant=True, direction="positive", summary="win"),
        Finding("refund_rate", MetricRole.GUARDRAIL, is_significant=True, direction="negative", summary="violation"),
    ]
    rec = generate_recommendation(findings)
    assert rec.decision == "don't ship"
    assert "refund_rate" in rec.rationale


def test_needs_more_data_when_no_significant_primary():
    findings = [
        Finding("conversion", MetricRole.PRIMARY, is_significant=False, direction="neutral", summary="flat"),
    ]
    rec = generate_recommendation(findings)
    assert rec.decision == "needs more data"


def test_inconclusive_when_mixed_primary():
    findings = [
        Finding("conversion", MetricRole.PRIMARY, is_significant=True, direction="positive", summary="win"),
        Finding("revenue", MetricRole.PRIMARY, is_significant=True, direction="negative", summary="loss"),
    ]
    rec = generate_recommendation(findings)
    assert rec.decision == "inconclusive"


def test_recommendation_has_caveats_list():
    findings = [Finding("cvr", MetricRole.PRIMARY, True, "positive", "win")]
    rec = generate_recommendation(findings)
    assert isinstance(rec.caveats, list)
