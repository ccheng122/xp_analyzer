from pathlib import Path
import yaml
from xp_analyzer.models import ExperimentConfig, MetricConfig, MetricType, MetricRole


def load_config(path: Path) -> ExperimentConfig:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with path.open() as f:
        data = yaml.safe_load(f)

    required = ["experiment_name", "group_column", "control_group", "metrics"]
    for key in required:
        if key not in data:
            raise ValueError(f"Config missing required field: '{key}'")

    metrics = [
        MetricConfig(
            name=m["name"],
            column=m["column"],
            type=MetricType(m["type"]),
            role=MetricRole(m["role"]),
            higher_is_better=m.get("higher_is_better", True),
            derive=m.get("derive"),
        )
        for m in data["metrics"]
    ]

    return ExperimentConfig(
        experiment_name=data["experiment_name"],
        group_column=data["group_column"],
        control_group=str(data["control_group"]),
        metrics=metrics,
        significance_threshold=data.get("significance_threshold", 0.05),
        correction_method=data.get("correction_method", "bonferroni"),
    )
