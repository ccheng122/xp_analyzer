from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional


class MetricType(str, Enum):
    CONTINUOUS = "continuous"
    BINARY = "binary"


class MetricRole(str, Enum):
    PRIMARY = "primary"
    GUARDRAIL = "guardrail"
    SECONDARY = "secondary"


@dataclass
class FilterBy:
    column: str
    condition: str  # supported: "not_null"


@dataclass
class MetricConfig:
    name: str
    column: str
    type: MetricType
    role: MetricRole
    higher_is_better: bool = True
    derive: Optional[str] = None  # "not_null" | None
    filter_by: Optional[FilterBy] = None


@dataclass
class ExperimentConfig:
    experiment_name: str
    group_column: str
    control_group: str
    metrics: list[MetricConfig]
    significance_threshold: float = 0.05
    correction_method: str = "bonferroni"  # "bonferroni" | "benjamini-hochberg"


@dataclass
class MetricResult:
    metric_name: str
    metric_type: MetricType
    metric_role: MetricRole
    higher_is_better: bool
    control_mean: float
    treatment_mean: float
    relative_lift: float
    absolute_lift: float
    p_value: float
    p_value_corrected: Optional[float]
    confidence_interval_low: float
    confidence_interval_high: float
    effect_size: float
    is_significant: bool
    control_n: int
    treatment_n: int


@dataclass
class Finding:
    metric_name: str
    metric_role: MetricRole
    is_significant: bool
    direction: str  # "positive" | "negative" | "neutral"
    summary: str


@dataclass
class Recommendation:
    decision: str  # "ship" | "don't ship" | "needs more data" | "inconclusive" | "review guardrail"
    rationale: str
    caveats: list[str] = field(default_factory=list)


@dataclass
class ExperimentResult:
    experiment_name: str
    control_group: str
    treatment_groups: list[str]
    total_users: int
    metric_results: list[MetricResult]
    findings: list[Finding]
    recommendation: Recommendation

    def to_dict(self) -> dict:
        return asdict(self)
