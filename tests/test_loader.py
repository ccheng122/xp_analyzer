import io
import pytest
from pathlib import Path
from xp_analyzer.loader import load_experiment_data
from xp_analyzer.models import ExperimentConfig, MetricConfig, MetricType, MetricRole, FilterBy

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


def test_filter_by_returns_filtered_values():
    config = make_config([
        MetricConfig(
            name="canceled",
            column="paid_plan_canceled",
            type=MetricType.BINARY,
            role=MetricRole.GUARDRAIL,
            higher_is_better=False,
            filter_by=FilterBy(column="paid_signup_date", condition="not_null"),
        ),
    ])
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    # Only users with a paid_signup_date (converters) are included
    assert groups["0"]["canceled"] == [0, 0]
    assert groups["1"]["canceled"] == [0, 0, 0]


def test_filter_by_reports_filtered_n():
    config = make_config([
        MetricConfig(
            name="canceled",
            column="paid_plan_canceled",
            type=MetricType.BINARY,
            role=MetricRole.GUARDRAIL,
            higher_is_better=False,
            filter_by=FilterBy(column="paid_signup_date", condition="not_null"),
        ),
    ])
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    assert len(groups["0"]["canceled"]) == 2   # 2 converters in control
    assert len(groups["1"]["canceled"]) == 3   # 3 converters in treatment


def test_filter_by_missing_column_raises():
    config = make_config([
        MetricConfig(
            name="canceled",
            column="paid_plan_canceled",
            type=MetricType.BINARY,
            role=MetricRole.GUARDRAIL,
            filter_by=FilterBy(column="nonexistent_col", condition="not_null"),
        ),
    ])
    with pytest.raises(ValueError, match="Filter column 'nonexistent_col' not found in CSV"):
        load_experiment_data(FIXTURES / "sample_with_dates.csv", config)


def test_filter_by_unknown_condition_raises():
    config = make_config([
        MetricConfig(
            name="canceled",
            column="paid_plan_canceled",
            type=MetricType.BINARY,
            role=MetricRole.GUARDRAIL,
            filter_by=FilterBy(column="paid_signup_date", condition="is_truthy"),
        ),
    ])
    with pytest.raises(ValueError, match="Unknown filter condition: 'is_truthy'"):
        load_experiment_data(FIXTURES / "sample_with_dates.csv", config)


def test_load_experiment_data_accepts_file_object(tmp_path):
    """load_experiment_data should accept a file-like object, not just a Path."""
    csv_content = "variant,converted\n0,1\n0,0\n1,1\n"
    from xp_analyzer.config import load_config_dict
    config = load_config_dict({
        "experiment_name": "t",
        "group_column": "variant",
        "control_group": "0",
        "metrics": [{"name": "conv", "column": "converted", "type": "binary", "role": "primary"}],
    })
    buf = io.BytesIO(csv_content.encode())
    groups = load_experiment_data(buf, config)
    assert "0" in groups
    assert "1" in groups
