import pytest
from pathlib import Path
from xp_analyzer.config import load_config
from xp_analyzer.models import MetricType, MetricRole

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
