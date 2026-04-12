import pytest
from pathlib import Path
from xp_analyzer.config import load_config, load_config_dict
from xp_analyzer.models import MetricType, MetricRole, FilterBy

FIXTURES = Path(__file__).parent / "fixtures"


def test_load_config_reads_basic_fields():
    config = load_config(FIXTURES / "sample_config.yaml")
    assert config.experiment_name == "Test Experiment"
    assert config.group_column == "treatment"
    assert config.control_group == "0"
    assert config.significance_threshold == 0.05
    assert config.correction_method == "bonferroni"


def test_load_config_parses_primary_metric():
    config = load_config(FIXTURES / "sample_config.yaml")
    primary = config.metrics[0]
    assert primary.name == "paid_conversion"
    assert primary.column == "paid_signup_date"
    assert primary.type == MetricType.BINARY
    assert primary.role == MetricRole.PRIMARY
    assert primary.higher_is_better is True
    assert primary.derive == "not_null"


def test_load_config_parses_guardrail_metric():
    config = load_config(FIXTURES / "sample_config.yaml")
    guardrail = config.metrics[1]
    assert guardrail.role == MetricRole.GUARDRAIL
    assert guardrail.higher_is_better is False
    assert guardrail.derive is None


def test_load_config_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        load_config(Path("nonexistent.yaml"))


def test_load_config_missing_required_field_raises(tmp_path):
    bad_config = tmp_path / "bad.yaml"
    bad_config.write_text("experiment_name: oops\n")
    with pytest.raises(ValueError, match="group_column"):
        load_config(bad_config)


def test_load_config_parses_filter_by():
    config = load_config(FIXTURES / "sample_config_with_filter.yaml")
    guardrail = config.metrics[0]
    assert guardrail.filter_by is not None
    assert isinstance(guardrail.filter_by, FilterBy)
    assert guardrail.filter_by.column == "paid_signup_date"
    assert guardrail.filter_by.condition == "not_null"


def test_load_config_filter_by_none_when_absent():
    config = load_config(FIXTURES / "sample_config.yaml")
    # existing sample_config.yaml has no filter_by — should be None
    for metric in config.metrics:
        assert metric.filter_by is None


def test_load_config_filter_by_missing_column_key_raises(tmp_path):
    bad = tmp_path / "bad.yaml"
    bad.write_text(
        "experiment_name: test\n"
        "group_column: treatment\n"
        "control_group: '0'\n"
        "metrics:\n"
        "  - name: m\n"
        "    column: c\n"
        "    type: binary\n"
        "    role: primary\n"
        "    filter_by:\n"
        "      condition: not_null\n"
    )
    with pytest.raises(ValueError, match="filter_by missing required key: 'column'"):
        load_config(bad)


def test_load_config_filter_by_missing_condition_key_raises(tmp_path):
    bad = tmp_path / "bad.yaml"
    bad.write_text(
        "experiment_name: test\n"
        "group_column: treatment\n"
        "control_group: '0'\n"
        "metrics:\n"
        "  - name: m\n"
        "    column: c\n"
        "    type: binary\n"
        "    role: primary\n"
        "    filter_by:\n"
        "      column: paid_signup_date\n"
    )
    with pytest.raises(ValueError, match="filter_by missing required key: 'condition'"):
        load_config(bad)


def test_load_config_dict_basic():
    data = {
        "experiment_name": "Test Exp",
        "group_column": "variant",
        "control_group": "0",
        "metrics": [
            {
                "name": "conversion",
                "column": "converted",
                "type": "binary",
                "role": "primary",
                "higher_is_better": True,
            }
        ],
    }
    config = load_config_dict(data)
    assert config.experiment_name == "Test Exp"
    assert config.control_group == "0"
    assert len(config.metrics) == 1
    assert config.metrics[0].type == MetricType.BINARY
    assert config.metrics[0].role == MetricRole.PRIMARY


def test_load_config_dict_missing_field():
    with pytest.raises(ValueError, match="missing required field"):
        load_config_dict({"experiment_name": "x", "group_column": "g", "control_group": "0"})
