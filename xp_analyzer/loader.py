from pathlib import Path
import pandas as pd
from xp_analyzer.models import ExperimentConfig, FilterBy


def _apply_filter(df: pd.DataFrame, filter_by: FilterBy) -> pd.Series:
    if filter_by.column not in df.columns:
        raise ValueError(f"Filter column '{filter_by.column}' not found in CSV")
    if filter_by.condition == "not_null":
        return df[filter_by.column].notna()
    raise ValueError(f"Unknown filter condition: '{filter_by.condition}'")


def load_experiment_data(
    csv_path: Path, config: ExperimentConfig
) -> dict[str, dict[str, list]]:
    """
    Returns: {group_name: {metric_name: [values]}}
    Group names are always strings.
    When a metric has filter_by, values and n reflect the filtered subpopulation only.
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
            if metric.filter_by is not None:
                mask = _apply_filter(group_df, metric.filter_by)
                filtered_df = group_df[mask]
            else:
                filtered_df = group_df
            series = filtered_df[metric.column]
            if metric.derive == "not_null":
                values = series.notna().astype(int).tolist()
            else:
                values = series.tolist()
            groups[group_name][metric.name] = values

    return groups
