import pytest
from pathlib import Path
from xp_analyzer.loader import load_experiment_data
from xp_analyzer.models import ExperimentConfig, MetricConfig, MetricType, MetricRole

FIXTURES = Path(__file__).parent / "fixtures"


def make_config(metrics, group_column="treatment", control_group="0"):
    return ExperimentConfig(
        experiment_name="test",
        group_column=group_column,
        control_group=control_group,
        metrics=metrics,
    )


def test_load_splits_by_group():
    config = make_config([
        MetricConfig(name="conversion", column="conversion", type=MetricType.BINARY, role=MetricRole.PRIMARY),
    ])
    groups = load_experiment_data(FIXTURES / "sample.csv", config)
    assert set(groups.keys()) == {"0", "1"}


def test_load_returns_correct_metric_values():
    config = make_config([
        MetricConfig(name="conversion", column="conversion", type=MetricType.BINARY, role=MetricRole.PRIMARY),
    ])
    groups = load_experiment_data(FIXTURES / "sample.csv", config)
    assert groups["0"]["conversion"] == [0, 1, 0, 1, 0]
    assert groups["1"]["conversion"] == [1, 1, 0, 1, 0]


def test_load_derives_not_null_as_binary():
    config = make_config([
        MetricConfig(
            name="paid_conversion",
            column="paid_signup_date",
            type=MetricType.BINARY,
            role=MetricRole.PRIMARY,
            derive="not_null",
        ),
    ])
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    assert groups["0"]["paid_conversion"] == [0, 1, 0, 1, 0]
    assert groups["1"]["paid_conversion"] == [1, 1, 0, 1, 0]


def test_load_group_column_as_string():
    config = make_config([
        MetricConfig(name="conversion", column="conversion", type=MetricType.BINARY, role=MetricRole.PRIMARY),
    ])
    groups = load_experiment_data(FIXTURES / "sample.csv", config)
    # Keys are always strings regardless of CSV dtype
    assert "0" in groups
    assert "1" in groups


def test_load_missing_metric_column_raises():
    config = make_config([
        MetricConfig(name="missing", column="nonexistent_col", type=MetricType.BINARY, role=MetricRole.PRIMARY),
    ])
    with pytest.raises(ValueError, match="Column 'nonexistent_col' not found"):
        load_experiment_data(FIXTURES / "sample.csv", config)


def test_load_missing_group_column_raises():
    config = make_config([], group_column="bad_group_col")
    with pytest.raises(ValueError, match="Group column 'bad_group_col' not found"):
        load_experiment_data(FIXTURES / "sample.csv", config)
