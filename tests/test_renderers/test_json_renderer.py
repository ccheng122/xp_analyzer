import json
import pytest
from xp_analyzer.renderers.json_renderer import render_json
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
        ],
        findings=[
            Finding("paid_conversion", MetricRole.PRIMARY, True, "positive", "Conversion improved by 15%."),
        ],
        recommendation=Recommendation(
            decision="ship",
            rationale="All primary metrics improved.",
            caveats=["Monitor post-launch."],
        ),
    )


def test_json_output_is_valid():
    output = render_json(make_result())
    parsed = json.loads(output)
    assert isinstance(parsed, dict)


def test_json_contains_required_top_level_keys():
    parsed = json.loads(render_json(make_result()))
    assert "experiment_name" in parsed
    assert "total_users" in parsed
    assert "metric_results" in parsed
    assert "findings" in parsed
    assert "recommendation" in parsed


def test_json_metric_result_structure():
    parsed = json.loads(render_json(make_result()))
    metric = parsed["metric_results"][0]
    assert metric["metric_name"] == "paid_conversion"
    assert metric["is_significant"] is True
    assert isinstance(metric["p_value"], float)
    assert isinstance(metric["relative_lift"], float)


def test_json_recommendation_structure():
    parsed = json.loads(render_json(make_result()))
    rec = parsed["recommendation"]
    assert rec["decision"] == "ship"
    assert isinstance(rec["caveats"], list)


def test_json_handles_inf_lift():
    result = make_result()
    result.metric_results[0].relative_lift = float("inf")
    output = render_json(result)
    parsed = json.loads(output)
    assert parsed["metric_results"][0]["relative_lift"] is None  # inf → null
