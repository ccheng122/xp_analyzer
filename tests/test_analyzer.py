import pytest
import numpy as np
from xp_analyzer.analyzer import analyze_continuous_metric


def test_continuous_detects_significant_difference():
    control = [10.0, 12.0, 11.0, 9.0, 10.5] * 40
    treatment = [15.0, 16.0, 14.0, 15.5, 16.5] * 40
    result = analyze_continuous_metric("revenue", control, treatment, alpha=0.05)
    assert result.is_significant is True
    assert result.relative_lift > 0
    assert result.p_value < 0.05


def test_continuous_detects_no_difference():
    rng = np.random.default_rng(42)
    control = rng.normal(10, 2, 200).tolist()
    treatment = rng.normal(10, 2, 200).tolist()
    result = analyze_continuous_metric("revenue", control, treatment, alpha=0.05)
    assert result.p_value > 0.001  # overwhelmingly likely not significant


def test_continuous_computes_correct_means():
    control = [10.0, 10.0, 10.0]
    treatment = [12.0, 12.0, 12.0]
    result = analyze_continuous_metric("revenue", control, treatment, alpha=0.05)
    assert result.control_mean == pytest.approx(10.0)
    assert result.treatment_mean == pytest.approx(12.0)
    assert result.relative_lift == pytest.approx(0.2)
    assert result.absolute_lift == pytest.approx(2.0)


def test_continuous_ci_contains_true_diff():
    control = [10.0] * 100
    treatment = [12.0] * 100
    result = analyze_continuous_metric("revenue", control, treatment, alpha=0.05)
    assert result.confidence_interval_low <= 2.0 <= result.confidence_interval_high


def test_continuous_sets_metric_metadata():
    result = analyze_continuous_metric("revenue", [1.0], [2.0], alpha=0.05)
    from xp_analyzer.models import MetricType
    assert result.metric_name == "revenue"
    assert result.metric_type == MetricType.CONTINUOUS
    assert result.control_n == 1
    assert result.treatment_n == 1
    assert result.p_value_corrected is None  # correction applied later
