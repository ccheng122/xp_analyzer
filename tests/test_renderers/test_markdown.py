import pytest
from xp_analyzer.renderers.markdown import render_markdown
from xp_analyzer.models import (
    ExperimentResult, MetricResult, MetricType, MetricRole,
    Finding, Recommendation,
)


def make_result():
    return ExperimentResult(
        experiment_name="Free to Plus Test",
        control_group="0",
        treatment_groups=["1"],
        total_users=1000,
        metric_results=[
            MetricResult(
                metric_name="paid_conversion",
                metric_type=MetricType.BINARY,
                metric_role=MetricRole.PRIMARY,
                higher_is_better=True,
                control_mean=0.10,
                treatment_mean=0.115,
                relative_lift=0.15,
                absolute_lift=0.015,
                p_value=0.001,
                p_value_corrected=0.001,
                confidence_interval_low=0.005,
                confidence_interval_high=0.025,
                effect_size=1.2,
                is_significant=True,
                control_n=500,
                treatment_n=500,
            ),
            MetricResult(
                metric_name="paid_plan_canceled",
                metric_type=MetricType.BINARY,
                metric_role=MetricRole.GUARDRAIL,
                higher_is_better=False,
                control_mean=0.05,
                treatment_mean=0.048,
                relative_lift=-0.04,
                absolute_lift=-0.002,
                p_value=0.72,
                p_value_corrected=0.72,
                confidence_interval_low=-0.01,
                confidence_interval_high=0.006,
                effect_size=0.05,
                is_significant=False,
                control_n=500,
                treatment_n=500,
            ),
        ],
        findings=[
            Finding("paid_conversion", MetricRole.PRIMARY, True, "positive", "Conversion improved by 15%."),
            Finding("paid_plan_canceled", MetricRole.GUARDRAIL, False, "neutral", "Guardrail safe."),
        ],
        recommendation=Recommendation(
            decision="ship",
            rationale="All primary metrics improved.",
            caveats=["Monitor post-launch."],
        ),
    )


def test_markdown_contains_experiment_name():
    output = render_markdown(make_result())
    assert "Free to Plus Test" in output


def test_markdown_contains_recommendation_decision():
    output = render_markdown(make_result())
    assert "ship" in output.lower()


def test_markdown_contains_metric_names():
    output = render_markdown(make_result())
    assert "paid_conversion" in output
    assert "paid_plan_canceled" in output


def test_markdown_contains_p_values():
    output = render_markdown(make_result())
    assert "0.001" in output


def test_markdown_contains_lift_values():
    output = render_markdown(make_result())
    assert "15" in output  # 15% lift


def test_markdown_contains_findings_section():
    output = render_markdown(make_result())
    assert "## Findings" in output


def test_markdown_contains_recommendation_section():
    output = render_markdown(make_result())
    assert "## Recommendation" in output


def test_markdown_contains_caveats():
    output = render_markdown(make_result())
    assert "Monitor post-launch" in output


def test_markdown_contains_table_headers():
    output = render_markdown(make_result())
    assert "Control" in output
    assert "Treatment" in output


def test_markdown_review_guardrail_renders_with_warning_emoji():
    result = make_result()
    result.recommendation = Recommendation(
        decision="review guardrail",
        rationale="paid_plan_canceled increased alongside paid_conversion — may reflect volume growth.",
        caveats=["Verify rate among converters."],
    )
    output = render_markdown(result)
    assert "⚠" in output
    assert "review guardrail" in output.lower()
