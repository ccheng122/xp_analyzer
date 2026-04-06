from pathlib import Path
import sys
import click
from xp_analyzer.config import load_config
from xp_analyzer.loader import load_experiment_data
from xp_analyzer.analyzer import run_analysis
from xp_analyzer.findings import generate_findings, generate_recommendation
from xp_analyzer.models import ExperimentResult
from xp_analyzer.renderers.markdown import render_markdown
from xp_analyzer.renderers.json_renderer import render_json


@click.command()
@click.option("--csv", "csv_path", required=True, help="Path to experiment CSV file")
@click.option("--config", "config_path", required=True, help="Path to experiment config YAML")
@click.option("--output", "output_path", default=None, help="Output file path (default: stdout)")
@click.option("--format", "fmt", default="markdown", type=click.Choice(["markdown", "json"]), help="Output format")
def main(csv_path: str, config_path: str, output_path: str | None, fmt: str) -> None:
    """Analyze an A/B experiment and produce a report."""
    csv = Path(csv_path)
    cfg_path = Path(config_path)

    if not csv.exists():
        click.echo(f"Error: CSV file not found: {csv}", err=True)
        sys.exit(1)
    if not cfg_path.exists():
        click.echo(f"Error: Config file not found: {cfg_path}", err=True)
        sys.exit(1)

    try:
        config = load_config(cfg_path)
        groups = load_experiment_data(csv, config)
        metric_results = run_analysis(config, groups)
        findings = generate_findings(metric_results)
        recommendation = generate_recommendation(findings)

        treatment_groups = [g for g in groups if g != config.control_group]
        total_users = sum(
            len(next(iter(group_data.values())))
            for group_data in groups.values()
        )

        result = ExperimentResult(
            experiment_name=config.experiment_name,
            control_group=config.control_group,
            treatment_groups=treatment_groups,
            total_users=total_users,
            metric_results=metric_results,
            findings=findings,
            recommendation=recommendation,
        )
    except (ValueError, KeyError) as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)

    report = render_markdown(result) if fmt == "markdown" else render_json(result)

    if output_path:
        Path(output_path).write_text(report)
        click.echo(f"Report written to {output_path}")
    else:
        click.echo(report)
