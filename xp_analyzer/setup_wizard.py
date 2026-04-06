import pandas as pd
from pathlib import Path


def _is_likely_binary(series: pd.Series) -> bool:
    non_null = series.dropna()
    if len(non_null) == 0:
        return False
    unique = set(non_null.unique())
    return unique.issubset({0, 1, "0", "1", True, False})


def _needs_derive(series: pd.Series) -> bool:
    """True if column has non-binary values that should be derived as not_null."""
    non_null = series.dropna()
    if len(non_null) == 0:
        return False
    return not _is_likely_binary(series) and series.isna().any()


def run_wizard(csv_path: Path) -> dict:
    """
    Interactive wizard. Returns a config dict ready to be serialized to YAML.
    Uses click.prompt() so it can be tested with CliRunner input simulation.
    """
    import click

    df = pd.read_csv(csv_path)
    all_columns = list(df.columns)

    click.echo(f"\nColumns found: {', '.join(all_columns)}\n")

    experiment_name = click.prompt("Experiment name")

    group_col = click.prompt(
        "Group column (which column identifies control vs treatment?)",
        type=click.Choice(all_columns),
    )
    unique_groups = sorted(df[group_col].dropna().astype(str).unique().tolist())
    click.echo(f"  → Unique values: {', '.join(unique_groups)}")
    control_group = click.prompt("Control group value", type=click.Choice(unique_groups))

    metric_columns = [c for c in all_columns if c != group_col]
    click.echo(f"\nClassify each remaining column (primary / guardrail / secondary / skip):\n")

    metrics = []
    for col in metric_columns:
        role = click.prompt(
            f"  {col} → role",
            type=click.Choice(["primary", "guardrail", "secondary", "skip"]),
        )
        if role == "skip":
            continue

        mtype = click.prompt(
            f"    Type",
            type=click.Choice(["binary", "continuous"]),
            default="binary" if _is_likely_binary(df[col]) or _needs_derive(df[col]) else "continuous",
        )

        derive = None
        if mtype == "binary" and _needs_derive(df[col]):
            if click.confirm("    Non-binary values detected. Derive as binary (non-null = 1)?", default=True):
                derive = "not_null"

        higher_is_better = click.confirm("    Higher is better?", default=True)

        name = click.prompt(f"    Metric name", default=col)

        entry = {
            "name": name,
            "column": col,
            "type": mtype,
            "role": role,
            "higher_is_better": higher_is_better,
        }
        if derive:
            entry["derive"] = derive
        metrics.append(entry)

    click.echo("")
    significance_threshold = click.prompt(
        "Significance threshold", default=0.05, type=float
    )
    correction_method = click.prompt(
        "Correction method",
        type=click.Choice(["bonferroni", "benjamini-hochberg"]),
        default="bonferroni",
    )

    return {
        "experiment_name": experiment_name,
        "group_column": group_col,
        "control_group": control_group,
        "significance_threshold": significance_threshold,
        "correction_method": correction_method,
        "metrics": metrics,
    }
