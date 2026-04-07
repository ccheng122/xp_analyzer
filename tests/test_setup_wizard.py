import pytest
import yaml
from pathlib import Path
from click.testing import CliRunner
from xp_analyzer.cli import setup as setup_cmd

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_CSV = FIXTURES / "sample_with_dates.csv"


def run_setup(csv_path, user_input: str, output_path: str = None):
    runner = CliRunner()
    args = ["--csv", str(csv_path)]
    if output_path:
        args += ["--output", output_path]
    return runner.invoke(setup_cmd, args, input=user_input)


# Column order after removing group col "treatment":
#   user_id, paid_signup_date, paid_plan_canceled
#
# paid_signup_date: has date strings + nulls → _needs_derive=True, default type=binary
# paid_plan_canceled: 0/1 values → _is_likely_binary=True, default type=binary, no derive

FULL_INPUT = "\n".join([
    "My Experiment",   # experiment name
    "treatment",       # group column
    "0",               # control group value
    # --- user_id ---
    "skip",            # role for user_id
    # --- paid_signup_date ---
    "primary",         # role
    "binary",          # type (default is binary, just confirm)
    "y",               # derive not_null (non-binary values detected)
    "n",               # filter to subset? (new)
    "y",               # higher is better
    "paid_conversion", # metric name
    # --- paid_plan_canceled ---
    "guardrail",       # role
    "binary",          # type
    "n",               # filter to subset? (new)
    "n",               # higher is better = False
    "",                # metric name (use column name default)
    # --- global settings ---
    "0.05",            # significance threshold
    "bonferroni",      # correction method
])

# Input for testing filter_by — skip paid_signup_date, add filter to paid_plan_canceled
FILTER_INPUT = "\n".join([
    "My Experiment",      # experiment name
    "treatment",          # group column
    "0",                  # control group value
    # --- user_id ---
    "skip",               # role for user_id
    # --- paid_signup_date ---
    "skip",               # skip this column
    # --- paid_plan_canceled ---
    "guardrail",          # role
    "binary",             # type
    "y",                  # filter to subset?
    "paid_signup_date",   # filter column (Choice from CSV columns)
    "not_null",           # condition (Choice: ["not_null"])
    "n",                  # higher is better = False
    "",                   # metric name (use column name default)
    # --- global settings ---
    "0.05",               # significance threshold
    "bonferroni",         # correction method
])


def test_setup_creates_config_file(tmp_path):
    out = str(tmp_path / "config.yaml")
    result = run_setup(SAMPLE_CSV, output_path=out, user_input=FULL_INPUT)
    assert result.exit_code == 0, result.output
    assert Path(out).exists()


def test_setup_config_has_correct_structure(tmp_path):
    out = str(tmp_path / "config.yaml")
    run_setup(SAMPLE_CSV, output_path=out, user_input=FULL_INPUT)
    config = yaml.safe_load(Path(out).read_text())
    assert config["experiment_name"] == "My Experiment"
    assert config["group_column"] == "treatment"
    assert config["control_group"] == "0"
    assert len(config["metrics"]) == 2


def test_setup_primary_metric_fields(tmp_path):
    out = str(tmp_path / "config.yaml")
    run_setup(SAMPLE_CSV, output_path=out, user_input=FULL_INPUT)
    config = yaml.safe_load(Path(out).read_text())
    primary = next(m for m in config["metrics"] if m["role"] == "primary")
    assert primary["name"] == "paid_conversion"
    assert primary["column"] == "paid_signup_date"
    assert primary["type"] == "binary"
    assert primary["derive"] == "not_null"
    assert primary["higher_is_better"] is True


def test_setup_guardrail_metric_fields(tmp_path):
    out = str(tmp_path / "config.yaml")
    run_setup(SAMPLE_CSV, output_path=out, user_input=FULL_INPUT)
    config = yaml.safe_load(Path(out).read_text())
    guardrail = next(m for m in config["metrics"] if m["role"] == "guardrail")
    assert guardrail["column"] == "paid_plan_canceled"
    assert guardrail["higher_is_better"] is False
    assert guardrail.get("derive") is None
    assert guardrail.get("filter_by") is None


def test_setup_missing_csv_exits_nonzero():
    runner = CliRunner()
    result = runner.invoke(setup_cmd, ["--csv", "no_such.csv"])
    assert result.exit_code != 0


def test_setup_prints_run_instructions(tmp_path):
    out = str(tmp_path / "config.yaml")
    result = run_setup(SAMPLE_CSV, output_path=out, user_input=FULL_INPUT)
    assert "xp-analyzer" in result.output
    assert "--config" in result.output


def test_setup_filter_by_prompt_produces_correct_config(tmp_path):
    out = str(tmp_path / "config.yaml")
    result = run_setup(SAMPLE_CSV, output_path=out, user_input=FILTER_INPUT)
    assert result.exit_code == 0, result.output
    config = yaml.safe_load(Path(out).read_text())
    guardrail = next(m for m in config["metrics"] if m["role"] == "guardrail")
    assert guardrail["filter_by"]["column"] == "paid_signup_date"
    assert guardrail["filter_by"]["condition"] == "not_null"
