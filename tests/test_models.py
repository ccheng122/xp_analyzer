import pytest
from xp_analyzer.models import (
    MetricType, MetricRole, MetricConfig, ExperimentConfig,
    MetricResult, Finding, Recommendation, ExperimentResult,
)


def test_metric_config_fields():
    m = MetricConfig(name="conversion", column="cvr", type=MetricType.BINARY, role=MetricRole.PRIMARY)
    assert m.name == "conversion"
    assert m.type == MetricType.BINARY
    assert m.higher_is_better is True
    assert m.derive is None


def test_experiment_config_defaults():
    config = ExperimentConfig(
        experiment_name="test",
        group_column="treatment",
        control_group="0",
        metrics=[MetricConfig(name="cvr", column="cvr", type=MetricType.BINARY, role=MetricRole.PRIMARY)],
    )
    assert config.significance_threshold == 0.05
    assert config.correction_method == "bonferroni"


def test_experiment_result_to_dict():
    result = ExperimentResult(
        experiment_name="test",
        control_group="0",
        treatment_groups=["1"],
        total_users=100,
        metric_results=[],
        findings=[],
        recommendation=Recommendation(decision="ship", rationale="all good", caveats=[]),
    )
    d = result.to_dict()
    assert d["experiment_name"] == "test"
    assert d["recommendation"]["decision"] == "ship"
    assert isinstance(d["metric_results"], list)
