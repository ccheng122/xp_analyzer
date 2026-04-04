from pathlib import Path
import pandas as pd
from xp_analyzer.models import ExperimentConfig


def load_experiment_data(
    csv_path: Path, config: ExperimentConfig
) -> dict[str, dict[str, list]]:
    """
    Returns: {group_name: {metric_name: [values]}}
    Group names are always strings.
    """
    df = pd.read_csv(csv_path)

    if config.group_column not in df.columns:
        raise ValueError(f"Group column '{config.group_column}' not found in CSV")

    for metric in config.metrics:
        if metric.column not in df.columns:
            raise ValueError(f"Column '{metric.column}' not found in CSV")

    # Normalize group column to string
    df[config.group_column] = df[config.group_column].astype(str)

    groups: dict[str, dict[str, list]] = {}
    for group_name, group_df in df.groupby(config.group_column):
        group_name = str(group_name)
        groups[group_name] = {}
        for metric in config.metrics:
            series = group_df[metric.column]
            if metric.derive == "not_null":
                values = series.notna().astype(int).tolist()
            else:
                values = series.tolist()
            groups[group_name][metric.name] = values

    return groups
