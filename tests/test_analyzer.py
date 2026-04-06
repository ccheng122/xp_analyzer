import pytest
import numpy as np
from xp_analyzer.analyzer import analyze_continuous_metric
from xp_analyzer.analyzer import analyze_binary_metric


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


def test_binary_detects_significant_difference():
    control = [0] * 900 + [1] * 100   # 10% conversion
    treatment = [0] * 750 + [1] * 250  # 25% conversion
    result = analyze_binary_metric("conversion", control, treatment, alpha=0.05)
    assert result.is_significant is True
    assert result.relative_lift == pytest.approx(1.5, rel=0.01)
    assert result.p_value < 0.05


def test_binary_detects_no_significant_difference():
    control = [0] * 800 + [1] * 200   # 20%
    treatment = [0] * 810 + [1] * 190  # 19%
    result = analyze_binary_metric("conversion", control, treatment, alpha=0.05)
    assert result.is_significant is False


def test_binary_computes_correct_means():
    control = [0, 0, 0, 1]   # 25%
    treatment = [1, 1, 0, 0]  # 50%
    result = analyze_binary_metric("conversion", control, treatment, alpha=0.05)
    assert result.control_mean == pytest.approx(0.25)
    assert result.treatment_mean == pytest.approx(0.5)
    assert result.relative_lift == pytest.approx(1.0)


def test_binary_zero_control_rate_relative_lift():
    control = [0] * 100
    treatment = [1] * 20 + [0] * 80
    result = analyze_binary_metric("conversion", control, treatment, alpha=0.05)
    assert result.relative_lift == float("inf")


def test_binary_sets_metric_metadata():
    result = analyze_binary_metric("conversion", [0, 1], [1, 1], alpha=0.05)
    from xp_analyzer.models import MetricType
    assert result.metric_type == MetricType.BINARY
    assert result.p_value_corrected is None


from xp_analyzer.analyzer import apply_correction, run_analysis
from xp_analyzer.config import load_config
from xp_analyzer.loader import load_experiment_data
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def test_bonferroni_multiplies_by_n():
    corrected = apply_correction([0.01, 0.03, 0.04], method="bonferroni")
    assert corrected == pytest.approx([0.03, 0.09, 0.12])


def test_bonferroni_caps_at_one():
    corrected = apply_correction([0.5, 0.6, 0.7], method="bonferroni")
    assert all(p <= 1.0 for p in corrected)


def test_bh_correction_returns_same_length():
    p_values = [0.001, 0.02, 0.04, 0.2]
    corrected = apply_correction(p_values, method="benjamini-hochberg")
    assert len(corrected) == 4


def test_bh_corrected_ge_original():
    p_values = [0.001, 0.02, 0.04, 0.2]
    corrected = apply_correction(p_values, method="benjamini-hochberg")
    assert all(c >= p for c, p in zip(corrected, p_values))


def test_run_analysis_returns_one_result_per_metric():
    config = load_config(FIXTURES / "sample_config.yaml")
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    results = run_analysis(config, groups)
    assert len(results) == len(config.metrics)


def test_run_analysis_applies_correction():
    config = load_config(FIXTURES / "sample_config.yaml")
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    results = run_analysis(config, groups)
    assert all(r.p_value_corrected is not None for r in results)


def test_run_analysis_uses_correct_metric_roles():
    config = load_config(FIXTURES / "sample_config.yaml")
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    results = run_analysis(config, groups)
    from xp_analyzer.models import MetricRole
    roles = {r.metric_name: r.metric_role for r in results}
    assert roles["paid_conversion"] == MetricRole.PRIMARY
    assert roles["paid_plan_canceled"] == MetricRole.GUARDRAIL
