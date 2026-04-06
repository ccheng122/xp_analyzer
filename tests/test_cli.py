import pytest
from pathlib import Path
from click.testing import CliRunner
from xp_analyzer.cli import main

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_CSV = FIXTURES / "sample_with_dates.csv"
SAMPLE_CONFIG = FIXTURES / "sample_config.yaml"


def test_cli_runs_successfully_outputs_to_stdout():
    runner = CliRunner()
    result = runner.invoke(main, ["--csv", str(SAMPLE_CSV), "--config", str(SAMPLE_CONFIG)])
    assert result.exit_code == 0, result.output
    assert "Experiment Report" in result.output


def test_cli_writes_to_output_file(tmp_path):
    out = tmp_path / "report.md"
    runner = CliRunner()
    result = runner.invoke(main, [
        "--csv", str(SAMPLE_CSV),
        "--config", str(SAMPLE_CONFIG),
        "--output", str(out),
    ])
    assert result.exit_code == 0
    assert out.exists()
    assert "Experiment Report" in out.read_text()


def test_cli_json_format(tmp_path):
    out = tmp_path / "report.json"
    runner = CliRunner()
    result = runner.invoke(main, [
        "--csv", str(SAMPLE_CSV),
        "--config", str(SAMPLE_CONFIG),
        "--format", "json",
        "--output", str(out),
    ])
    assert result.exit_code == 0
    import json
    data = json.loads(out.read_text())
    assert "experiment_name" in data


def test_cli_missing_csv_exits_nonzero():
    runner = CliRunner()
    result = runner.invoke(main, ["--csv", "no_such.csv", "--config", str(SAMPLE_CONFIG)])
    assert result.exit_code != 0


def test_cli_missing_config_exits_nonzero():
    runner = CliRunner()
    result = runner.invoke(main, ["--csv", str(SAMPLE_CSV), "--config", "no_such.yaml"])
    assert result.exit_code != 0
