from pathlib import Path
from click.testing import CliRunner
from xp_analyzer.cli import main

REAL_CSV = Path(__file__).parent.parent / "xp_data" / "free_plus_experiment.csv"
REAL_CONFIG = Path(__file__).parent.parent / "xp_data" / "free_plus_config.yaml"


def test_integration_runs_on_real_data():
    runner = CliRunner()
    result = runner.invoke(main, ["--csv", str(REAL_CSV), "--config", str(REAL_CONFIG)])
    assert result.exit_code == 0, result.output
    assert "Free to Plus Upgrade Experiment" in result.output
    assert "Recommendation" in result.output


def test_integration_produces_valid_json(tmp_path):
    import json
    out = tmp_path / "report.json"
    runner = CliRunner()
    result = runner.invoke(main, [
        "--csv", str(REAL_CSV),
        "--config", str(REAL_CONFIG),
        "--format", "json",
        "--output", str(out),
    ])
    assert result.exit_code == 0
    data = json.loads(out.read_text())
    assert data["experiment_name"] == "Free to Plus Upgrade Experiment"
    assert len(data["metric_results"]) == 2
    assert data["recommendation"]["decision"] in ["ship", "don't ship", "needs more data", "inconclusive"]
