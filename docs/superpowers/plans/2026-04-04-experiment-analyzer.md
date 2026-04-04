# Experiment Analyzer CLI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python CLI tool that ingests a CSV of experiment data, runs frequentist statistical analysis, and outputs a Markdown report with results, findings, and a ship/no-ship recommendation.

**Architecture:** Core analysis engine (`analyzer.py`) is decoupled from presentation — it produces structured `ExperimentResult` dataclasses that renderers consume. The CLI is a thin wrapper that wires together config loading, CSV ingestion, analysis, and rendering. This makes it trivial to add a web/API layer in Phase 2 without touching analysis logic.

**Tech Stack:** Python 3.11+, pandas (CSV), scipy + statsmodels (stats), PyYAML (config), click (CLI), pytest (tests)

---

## File Map

```
xp_analyzer/
  __init__.py
  models.py              ← dataclasses: MetricConfig, ExperimentConfig, MetricResult, Finding, Recommendation, ExperimentResult
  config.py              ← load_config(path) → ExperimentConfig from YAML
  loader.py              ← load_experiment_data(csv_path, config) → dict[group, dict[metric, list[values]]]
  analyzer.py            ← analyze_continuous_metric(), analyze_binary_metric(), apply_correction(), run_analysis()
  findings.py            ← generate_findings(metric_results) → list[Finding], generate_recommendation(findings) → Recommendation
  renderers/
    __init__.py
    markdown.py          ← render_markdown(result) → str
    json_renderer.py     ← render_json(result) → str
  cli.py                 ← click entrypoint: main()
tests/
  __init__.py
  test_models.py
  test_config.py
  test_loader.py
  test_analyzer.py
  test_findings.py
  test_renderers/
    __init__.py
    test_markdown.py
    test_json_renderer.py
  fixtures/
    sample.csv
    sample_with_dates.csv
    sample_config.yaml
docs/
  superpowers/plans/
    2026-04-04-experiment-analyzer.md   ← this file
pyproject.toml
```

---

## Task 1: Project Setup

**Files:**
- Create: `pyproject.toml`
- Create: `xp_analyzer/__init__.py`
- Create: `tests/__init__.py`
- Create: `tests/renderers/__init__.py`
- Create: `tests/fixtures/sample.csv`
- Create: `tests/fixtures/sample_with_dates.csv`
- Create: `tests/fixtures/sample_config.yaml`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "xp-analyzer"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "pandas>=2.0",
    "scipy>=1.11",
    "statsmodels>=0.14",
    "pyyaml>=6.0",
    "click>=8.1",
]

[project.scripts]
xp-analyzer = "xp_analyzer.cli:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 2: Create package and test init files**

```
touch xp_analyzer/__init__.py
touch tests/__init__.py
mkdir -p tests/renderers && touch tests/renderers/__init__.py
mkdir -p tests/fixtures
```

- [ ] **Step 3: Create test fixtures**

`tests/fixtures/sample.csv`:
```csv
user_id,treatment,revenue,conversion,refund_rate
u1,0,0.0,0,0
u2,0,25.0,1,0
u3,0,0.0,0,1
u4,0,10.0,1,0
u5,0,0.0,0,0
u6,1,30.0,1,0
u7,1,35.0,1,0
u8,1,0.0,0,0
u9,1,28.0,1,0
u10,1,0.0,0,0
```

`tests/fixtures/sample_with_dates.csv`:
```csv
user_id,treatment,paid_signup_date,paid_plan_canceled
u1,0,,0
u2,0,2023-07-10,0
u3,0,,1
u4,0,2023-07-12,0
u5,0,,0
u6,1,2023-07-15,0
u7,1,2023-07-16,0
u8,1,,0
u9,1,2023-07-17,0
u10,1,,0
```

`tests/fixtures/sample_config.yaml`:
```yaml
experiment_name: "Test Experiment"
group_column: treatment
control_group: "0"
significance_threshold: 0.05
correction_method: bonferroni
metrics:
  - name: paid_conversion
    column: paid_signup_date
    type: binary
    role: primary
    higher_is_better: true
    derive: not_null
  - name: paid_plan_canceled
    column: paid_plan_canceled
    type: binary
    role: guardrail
    higher_is_better: false
```

- [ ] **Step 4: Install dependencies**

```bash
pip install -e ".[dev]" 2>/dev/null || pip install pandas scipy statsmodels pyyaml click pytest
```

- [ ] **Step 5: Verify pytest runs (empty)**

```bash
pytest tests/ -v
```
Expected: `no tests ran` or `0 passed`

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml xp_analyzer/ tests/
git commit -m "chore: project scaffold with fixtures and dependencies"
```

---

## Task 2: Models

**Files:**
- Create: `xp_analyzer/models.py`
- Create: `tests/test_models.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_models.py`:
```python
import pytest
from xp_analyzer.models import (
    MetricType, MetricRole, MetricConfig, ExperimentConfig,
    MetricResult, Finding, Recommendation, ExperimentResult,
)


def test_metric_config_fields():
    m = MetricConfig(name="conversion", column="cvr", type=MetricType.BINARY, role=MetricRole.PRIMARY)
    assert m.name == "conversion"
    assert m.type == MetricType.BINARY
    assert m.higher_is_better is True
    assert m.derive is None


def test_experiment_config_defaults():
    config = ExperimentConfig(
        experiment_name="test",
        group_column="treatment",
        control_group="0",
        metrics=[MetricConfig(name="cvr", column="cvr", type=MetricType.BINARY, role=MetricRole.PRIMARY)],
    )
    assert config.significance_threshold == 0.05
    assert config.correction_method == "bonferroni"


def test_experiment_result_to_dict():
    result = ExperimentResult(
        experiment_name="test",
        control_group="0",
        treatment_groups=["1"],
        total_users=100,
        metric_results=[],
        findings=[],
        recommendation=Recommendation(decision="ship", rationale="all good", caveats=[]),
    )
    d = result.to_dict()
    assert d["experiment_name"] == "test"
    assert d["recommendation"]["decision"] == "ship"
    assert isinstance(d["metric_results"], list)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_models.py -v
```
Expected: `ImportError` or `ModuleNotFoundError`

- [ ] **Step 3: Implement models**

`xp_analyzer/models.py`:
```python
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
class MetricConfig:
    name: str
    column: str
    type: MetricType
    role: MetricRole
    higher_is_better: bool = True
    derive: Optional[str] = None  # "not_null" | None


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
    decision: str  # "ship" | "don't ship" | "needs more data" | "inconclusive"
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_models.py -v
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add xp_analyzer/models.py tests/test_models.py
git commit -m "feat: add core data models"
```

---

## Task 3: Config Loader

**Files:**
- Create: `xp_analyzer/config.py`
- Create: `tests/test_config.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_config.py`:
```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_config.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Implement config loader**

`xp_analyzer/config.py`:
```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_config.py -v
```
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add xp_analyzer/config.py tests/test_config.py
git commit -m "feat: add YAML config loader"
```

---

## Task 4: CSV Loader

**Files:**
- Create: `xp_analyzer/loader.py`
- Create: `tests/test_loader.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_loader.py`:
```python
import pytest
from pathlib import Path
from xp_analyzer.loader import load_experiment_data
from xp_analyzer.models import ExperimentConfig, MetricConfig, MetricType, MetricRole

FIXTURES = Path(__file__).parent / "fixtures"


def make_config(metrics, group_column="treatment", control_group="0"):
    return ExperimentConfig(
        experiment_name="test",
        group_column=group_column,
        control_group=control_group,
        metrics=metrics,
    )


def test_load_splits_by_group():
    config = make_config([
        MetricConfig(name="conversion", column="conversion", type=MetricType.BINARY, role=MetricRole.PRIMARY),
    ])
    groups = load_experiment_data(FIXTURES / "sample.csv", config)
    assert set(groups.keys()) == {"0", "1"}


def test_load_returns_correct_metric_values():
    config = make_config([
        MetricConfig(name="conversion", column="conversion", type=MetricType.BINARY, role=MetricRole.PRIMARY),
    ])
    groups = load_experiment_data(FIXTURES / "sample.csv", config)
    assert groups["0"]["conversion"] == [0, 1, 0, 1, 0]
    assert groups["1"]["conversion"] == [1, 1, 0, 1, 0]


def test_load_derives_not_null_as_binary():
    config = make_config([
        MetricConfig(
            name="paid_conversion",
            column="paid_signup_date",
            type=MetricType.BINARY,
            role=MetricRole.PRIMARY,
            derive="not_null",
        ),
    ])
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    assert groups["0"]["paid_conversion"] == [0, 1, 0, 1, 0]
    assert groups["1"]["paid_conversion"] == [1, 1, 0, 1, 0]


def test_load_group_column_as_string():
    config = make_config([
        MetricConfig(name="conversion", column="conversion", type=MetricType.BINARY, role=MetricRole.PRIMARY),
    ])
    groups = load_experiment_data(FIXTURES / "sample.csv", config)
    # Keys are always strings regardless of CSV dtype
    assert "0" in groups
    assert "1" in groups


def test_load_missing_metric_column_raises():
    config = make_config([
        MetricConfig(name="missing", column="nonexistent_col", type=MetricType.BINARY, role=MetricRole.PRIMARY),
    ])
    with pytest.raises(ValueError, match="Column 'nonexistent_col' not found"):
        load_experiment_data(FIXTURES / "sample.csv", config)


def test_load_missing_group_column_raises():
    config = make_config([], group_column="bad_group_col")
    with pytest.raises(ValueError, match="Group column 'bad_group_col' not found"):
        load_experiment_data(FIXTURES / "sample.csv", config)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_loader.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Implement loader**

`xp_analyzer/loader.py`:
```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_loader.py -v
```
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add xp_analyzer/loader.py tests/test_loader.py
git commit -m "feat: add CSV loader with derive support"
```

---

## Task 5: Statistical Analyzer — Continuous Metrics

**Files:**
- Create: `xp_analyzer/analyzer.py`
- Create: `tests/test_analyzer.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_analyzer.py`:
```python
import pytest
import numpy as np
from xp_analyzer.analyzer import analyze_continuous_metric


def test_continuous_detects_significant_difference():
    control = [10.0, 12.0, 11.0, 9.0, 10.5] * 40
    treatment = [15.0, 16.0, 14.0, 15.5, 16.5] * 40
    result = analyze_continuous_metric("revenue", control, treatment, alpha=0.05)
    assert result.is_significant is True
    assert result.relative_lift > 0
    assert result.p_value < 0.05


def test_continuous_detects_no_difference():
    rng = np.random.default_rng(42)
    control = rng.normal(10, 2, 200).tolist()
    treatment = rng.normal(10, 2, 200).tolist()
    result = analyze_continuous_metric("revenue", control, treatment, alpha=0.05)
    assert result.p_value > 0.001  # overwhelmingly likely not significant


def test_continuous_computes_correct_means():
    control = [10.0, 10.0, 10.0]
    treatment = [12.0, 12.0, 12.0]
    result = analyze_continuous_metric("revenue", control, treatment, alpha=0.05)
    assert result.control_mean == pytest.approx(10.0)
    assert result.treatment_mean == pytest.approx(12.0)
    assert result.relative_lift == pytest.approx(0.2)
    assert result.absolute_lift == pytest.approx(2.0)


def test_continuous_ci_contains_true_diff():
    control = [10.0] * 100
    treatment = [12.0] * 100
    result = analyze_continuous_metric("revenue", control, treatment, alpha=0.05)
    assert result.confidence_interval_low <= 2.0 <= result.confidence_interval_high


def test_continuous_sets_metric_metadata():
    result = analyze_continuous_metric("revenue", [1.0], [2.0], alpha=0.05)
    from xp_analyzer.models import MetricType
    assert result.metric_name == "revenue"
    assert result.metric_type == MetricType.CONTINUOUS
    assert result.control_n == 1
    assert result.treatment_n == 1
    assert result.p_value_corrected is None  # correction applied later
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_analyzer.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Implement continuous metric analysis**

`xp_analyzer/analyzer.py`:
```python
from typing import Optional
import numpy as np
from scipy import stats
from xp_analyzer.models import MetricResult, MetricType, MetricRole


def analyze_continuous_metric(
    name: str,
    control: list[float],
    treatment: list[float],
    alpha: float = 0.05,
    higher_is_better: bool = True,
    role: MetricRole = MetricRole.PRIMARY,
) -> MetricResult:
    c = np.array(control, dtype=float)
    t = np.array(treatment, dtype=float)

    control_mean = float(np.mean(c))
    treatment_mean = float(np.mean(t))
    absolute_lift = treatment_mean - control_mean
    relative_lift = absolute_lift / control_mean if control_mean != 0 else float("inf")

    _, p_value = stats.ttest_ind(c, t)

    # Cohen's d
    pooled_std = float(np.sqrt((np.var(c, ddof=1) + np.var(t, ddof=1)) / 2))
    effect_size = absolute_lift / pooled_std if pooled_std > 0 else 0.0

    # 95% CI for difference in means
    se = float(np.sqrt(np.var(c, ddof=1) / len(c) + np.var(t, ddof=1) / len(t)))
    ci_low = absolute_lift - 1.96 * se
    ci_high = absolute_lift + 1.96 * se

    return MetricResult(
        metric_name=name,
        metric_type=MetricType.CONTINUOUS,
        metric_role=role,
        higher_is_better=higher_is_better,
        control_mean=control_mean,
        treatment_mean=treatment_mean,
        relative_lift=relative_lift,
        absolute_lift=absolute_lift,
        p_value=float(p_value),
        p_value_corrected=None,
        confidence_interval_low=ci_low,
        confidence_interval_high=ci_high,
        effect_size=effect_size,
        is_significant=float(p_value) < alpha,
        control_n=len(control),
        treatment_n=len(treatment),
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_analyzer.py -v
```
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add xp_analyzer/analyzer.py tests/test_analyzer.py
git commit -m "feat: add continuous metric analysis (t-test, Cohen's d, CI)"
```

---

## Task 6: Statistical Analyzer — Binary Metrics

**Files:**
- Modify: `xp_analyzer/analyzer.py`
- Modify: `tests/test_analyzer.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_analyzer.py`:
```python
from xp_analyzer.analyzer import analyze_binary_metric


def test_binary_detects_significant_difference():
    control = [0] * 900 + [1] * 100   # 10% conversion
    treatment = [0] * 750 + [1] * 250  # 25% conversion
    result = analyze_binary_metric("conversion", control, treatment, alpha=0.05)
    assert result.is_significant is True
    assert result.relative_lift == pytest.approx(1.5, rel=0.01)
    assert result.p_value < 0.05


def test_binary_detects_no_significant_difference():
    control = [0] * 800 + [1] * 200   # 20%
    treatment = [0] * 810 + [1] * 190  # 19%
    result = analyze_binary_metric("conversion", control, treatment, alpha=0.05)
    assert result.is_significant is False


def test_binary_computes_correct_means():
    control = [0, 0, 0, 1]   # 25%
    treatment = [1, 1, 0, 0]  # 50%
    result = analyze_binary_metric("conversion", control, treatment, alpha=0.05)
    assert result.control_mean == pytest.approx(0.25)
    assert result.treatment_mean == pytest.approx(0.5)
    assert result.relative_lift == pytest.approx(1.0)


def test_binary_zero_control_rate_relative_lift():
    control = [0] * 100
    treatment = [1] * 20 + [0] * 80
    result = analyze_binary_metric("conversion", control, treatment, alpha=0.05)
    assert result.relative_lift == float("inf")


def test_binary_sets_metric_metadata():
    result = analyze_binary_metric("conversion", [0, 1], [1, 1], alpha=0.05)
    from xp_analyzer.models import MetricType
    assert result.metric_type == MetricType.BINARY
    assert result.p_value_corrected is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_analyzer.py::test_binary_detects_significant_difference -v
```
Expected: `ImportError` or `AttributeError`

- [ ] **Step 3: Implement binary metric analysis**

Add to `xp_analyzer/analyzer.py`:
```python
from statsmodels.stats.proportion import proportions_ztest


def analyze_binary_metric(
    name: str,
    control: list[int],
    treatment: list[int],
    alpha: float = 0.05,
    higher_is_better: bool = True,
    role: MetricRole = MetricRole.PRIMARY,
) -> MetricResult:
    c = np.array(control, dtype=int)
    t = np.array(treatment, dtype=int)

    control_rate = float(np.mean(c))
    treatment_rate = float(np.mean(t))
    absolute_lift = treatment_rate - control_rate
    relative_lift = absolute_lift / control_rate if control_rate != 0 else float("inf")

    count = np.array([int(t.sum()), int(c.sum())])
    nobs = np.array([len(t), len(c)])
    _, p_value = proportions_ztest(count, nobs)

    # Effect size: relative risk (risk ratio)
    effect_size = treatment_rate / control_rate if control_rate != 0 else float("inf")

    # 95% CI for difference in proportions (normal approximation)
    se = float(np.sqrt(
        control_rate * (1 - control_rate) / len(c)
        + treatment_rate * (1 - treatment_rate) / len(t)
    ))
    ci_low = absolute_lift - 1.96 * se
    ci_high = absolute_lift + 1.96 * se

    return MetricResult(
        metric_name=name,
        metric_type=MetricType.BINARY,
        metric_role=role,
        higher_is_better=higher_is_better,
        control_mean=control_rate,
        treatment_mean=treatment_rate,
        relative_lift=relative_lift,
        absolute_lift=absolute_lift,
        p_value=float(p_value),
        p_value_corrected=None,
        confidence_interval_low=ci_low,
        confidence_interval_high=ci_high,
        effect_size=effect_size,
        is_significant=float(p_value) < alpha,
        control_n=len(control),
        treatment_n=len(treatment),
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_analyzer.py -v
```
Expected: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add xp_analyzer/analyzer.py tests/test_analyzer.py
git commit -m "feat: add binary metric analysis (proportions z-test)"
```

---

## Task 7: Multiple Comparison Correction + run_analysis Orchestrator

**Files:**
- Modify: `xp_analyzer/analyzer.py`
- Modify: `tests/test_analyzer.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_analyzer.py`:
```python
from xp_analyzer.analyzer import apply_correction, run_analysis
from xp_analyzer.config import load_config
from xp_analyzer.loader import load_experiment_data
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def test_bonferroni_multiplies_by_n():
    corrected = apply_correction([0.01, 0.03, 0.04], method="bonferroni")
    assert corrected == pytest.approx([0.03, 0.09, 0.12])


def test_bonferroni_caps_at_one():
    corrected = apply_correction([0.5, 0.6, 0.7], method="bonferroni")
    assert all(p <= 1.0 for p in corrected)


def test_bh_correction_returns_same_length():
    p_values = [0.001, 0.02, 0.04, 0.2]
    corrected = apply_correction(p_values, method="benjamini-hochberg")
    assert len(corrected) == 4


def test_bh_corrected_ge_original():
    p_values = [0.001, 0.02, 0.04, 0.2]
    corrected = apply_correction(p_values, method="benjamini-hochberg")
    assert all(c >= p for c, p in zip(corrected, p_values))


def test_run_analysis_returns_one_result_per_metric():
    config = load_config(FIXTURES / "sample_config.yaml")
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    results = run_analysis(config, groups)
    assert len(results) == len(config.metrics)


def test_run_analysis_applies_correction():
    config = load_config(FIXTURES / "sample_config.yaml")
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    results = run_analysis(config, groups)
    assert all(r.p_value_corrected is not None for r in results)


def test_run_analysis_uses_correct_metric_roles():
    config = load_config(FIXTURES / "sample_config.yaml")
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    results = run_analysis(config, groups)
    from xp_analyzer.models import MetricRole
    roles = {r.metric_name: r.metric_role for r in results}
    assert roles["paid_conversion"] == MetricRole.PRIMARY
    assert roles["paid_plan_canceled"] == MetricRole.GUARDRAIL
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_analyzer.py::test_bonferroni_multiplies_by_n -v
```
Expected: `ImportError`

- [ ] **Step 3: Implement correction and orchestrator**

Add to `xp_analyzer/analyzer.py`:
```python
from xp_analyzer.models import ExperimentConfig, MetricType


def apply_correction(p_values: list[float], method: str) -> list[float]:
    n = len(p_values)
    if method == "bonferroni":
        return [min(p * n, 1.0) for p in p_values]
    if method == "benjamini-hochberg":
        # Benjamini-Hochberg procedure
        indexed = sorted(enumerate(p_values), key=lambda x: x[1])
        corrected = [0.0] * n
        for rank, (orig_idx, p) in enumerate(indexed, start=1):
            corrected[orig_idx] = min(p * n / rank, 1.0)
        # Enforce monotonicity (step-down)
        for i in range(n - 2, -1, -1):
            orig_idx_curr = sorted(enumerate(p_values), key=lambda x: x[1])[i][0]
            orig_idx_next = sorted(enumerate(p_values), key=lambda x: x[1])[i + 1][0]
            corrected[orig_idx_curr] = min(corrected[orig_idx_curr], corrected[orig_idx_next])
        return corrected
    raise ValueError(f"Unknown correction method: {method}")


def run_analysis(
    config: ExperimentConfig,
    groups: dict[str, dict[str, list]],
) -> list[MetricResult]:
    control = groups[config.control_group]
    treatment_group = next(g for g in groups if g != config.control_group)
    treatment = groups[treatment_group]

    results = []
    for metric in config.metrics:
        ctrl_vals = control[metric.name]
        trt_vals = treatment[metric.name]
        if metric.type == MetricType.CONTINUOUS:
            result = analyze_continuous_metric(
                metric.name, ctrl_vals, trt_vals,
                alpha=config.significance_threshold,
                higher_is_better=metric.higher_is_better,
                role=metric.role,
            )
        else:
            result = analyze_binary_metric(
                metric.name, ctrl_vals, trt_vals,
                alpha=config.significance_threshold,
                higher_is_better=metric.higher_is_better,
                role=metric.role,
            )
        results.append(result)

    # Apply multiple comparison correction to primary metrics only
    primary_indices = [i for i, m in enumerate(config.metrics) if m.role.value == "primary"]
    primary_p_values = [results[i].p_value for i in primary_indices]
    corrected = apply_correction(primary_p_values, method=config.correction_method)
    for i, idx in enumerate(primary_indices):
        results[idx].p_value_corrected = corrected[i]
        results[idx].is_significant = corrected[i] < config.significance_threshold

    # Guardrail metrics get their own p_value as corrected (no correction applied)
    for i, metric in enumerate(config.metrics):
        if metric.role.value != "primary":
            results[i].p_value_corrected = results[i].p_value

    return results
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_analyzer.py -v
```
Expected: `17 passed`

- [ ] **Step 5: Commit**

```bash
git add xp_analyzer/analyzer.py tests/test_analyzer.py
git commit -m "feat: add multiple comparison correction and run_analysis orchestrator"
```

---

## Task 8: Findings Generator

**Files:**
- Create: `xp_analyzer/findings.py`
- Create: `tests/test_findings.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_findings.py`:
```python
import pytest
from xp_analyzer.findings import generate_findings, generate_recommendation
from xp_analyzer.models import MetricResult, MetricType, MetricRole, Finding


def make_result(name, role, is_significant, relative_lift, higher_is_better=True, p_value=0.01):
    return MetricResult(
        metric_name=name,
        metric_type=MetricType.BINARY,
        metric_role=role,
        higher_is_better=higher_is_better,
        control_mean=0.1,
        treatment_mean=0.1 * (1 + relative_lift) if relative_lift != float("inf") else 0.2,
        relative_lift=relative_lift,
        absolute_lift=0.1 * relative_lift if relative_lift != float("inf") else 0.1,
        p_value=p_value,
        p_value_corrected=p_value,
        confidence_interval_low=-0.01,
        confidence_interval_high=0.05,
        effect_size=0.2,
        is_significant=is_significant,
        control_n=1000,
        treatment_n=1000,
    )


# --- generate_findings ---

def test_significant_positive_primary_is_positive():
    results = [make_result("conversion", MetricRole.PRIMARY, True, 0.15)]
    findings = generate_findings(results)
    assert findings[0].direction == "positive"
    assert findings[0].is_significant is True


def test_not_significant_is_neutral():
    results = [make_result("conversion", MetricRole.PRIMARY, False, 0.02, p_value=0.4)]
    findings = generate_findings(results)
    assert findings[0].direction == "neutral"


def test_guardrail_positive_lift_lower_is_better_is_negative():
    # refund_rate went UP (lift=+0.30) — bad because higher_is_better=False
    results = [make_result("refund_rate", MetricRole.GUARDRAIL, True, 0.30, higher_is_better=False)]
    findings = generate_findings(results)
    assert findings[0].direction == "negative"


def test_guardrail_negative_lift_lower_is_better_is_positive():
    # refund_rate went DOWN (lift=-0.20) — good because higher_is_better=False
    results = [make_result("refund_rate", MetricRole.GUARDRAIL, True, -0.20, higher_is_better=False)]
    findings = generate_findings(results)
    assert findings[0].direction == "positive"


def test_finding_summary_is_non_empty_string():
    results = [make_result("conversion", MetricRole.PRIMARY, True, 0.15)]
    findings = generate_findings(results)
    assert isinstance(findings[0].summary, str)
    assert len(findings[0].summary) > 0


# --- generate_recommendation ---

def test_ship_when_all_primary_win_no_guardrail_violation():
    findings = [
        Finding("conversion", MetricRole.PRIMARY, is_significant=True, direction="positive", summary="win"),
    ]
    rec = generate_recommendation(findings)
    assert rec.decision == "ship"


def test_no_ship_when_guardrail_violated():
    findings = [
        Finding("conversion", MetricRole.PRIMARY, is_significant=True, direction="positive", summary="win"),
        Finding("refund_rate", MetricRole.GUARDRAIL, is_significant=True, direction="negative", summary="violation"),
    ]
    rec = generate_recommendation(findings)
    assert rec.decision == "don't ship"
    assert "refund_rate" in rec.rationale


def test_needs_more_data_when_no_significant_primary():
    findings = [
        Finding("conversion", MetricRole.PRIMARY, is_significant=False, direction="neutral", summary="flat"),
    ]
    rec = generate_recommendation(findings)
    assert rec.decision == "needs more data"


def test_inconclusive_when_mixed_primary():
    findings = [
        Finding("conversion", MetricRole.PRIMARY, is_significant=True, direction="positive", summary="win"),
        Finding("revenue", MetricRole.PRIMARY, is_significant=True, direction="negative", summary="loss"),
    ]
    rec = generate_recommendation(findings)
    assert rec.decision == "inconclusive"


def test_recommendation_has_caveats_list():
    findings = [Finding("cvr", MetricRole.PRIMARY, True, "positive", "win")]
    rec = generate_recommendation(findings)
    assert isinstance(rec.caveats, list)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_findings.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Implement findings generator**

`xp_analyzer/findings.py`:
```python
from xp_analyzer.models import MetricResult, MetricRole, Finding, Recommendation


def _is_improvement(relative_lift: float, higher_is_better: bool) -> bool:
    if relative_lift == float("inf"):
        return higher_is_better
    if higher_is_better:
        return relative_lift > 0
    return relative_lift < 0


def generate_findings(metric_results: list[MetricResult]) -> list[Finding]:
    findings = []
    for r in metric_results:
        if not r.is_significant:
            direction = "neutral"
            summary = (
                f"{r.metric_name} showed no statistically significant change "
                f"(p={r.p_value_corrected:.3f}, lift={r.relative_lift:+.1%})."
            )
        elif _is_improvement(r.relative_lift, r.higher_is_better):
            direction = "positive"
            summary = (
                f"{r.metric_name} improved by {r.relative_lift:+.1%} "
                f"(p={r.p_value_corrected:.3f}), a statistically significant win."
            )
        else:
            direction = "negative"
            label = "guardrail violation" if r.metric_role == MetricRole.GUARDRAIL else "regression"
            summary = (
                f"{r.metric_name} worsened by {r.relative_lift:+.1%} "
                f"(p={r.p_value_corrected:.3f}) — {label}."
            )
        findings.append(Finding(
            metric_name=r.metric_name,
            metric_role=r.metric_role,
            is_significant=r.is_significant,
            direction=direction,
            summary=summary,
        ))
    return findings


def generate_recommendation(findings: list[Finding]) -> Recommendation:
    guardrail_violations = [
        f for f in findings
        if f.metric_role == MetricRole.GUARDRAIL and f.is_significant and f.direction == "negative"
    ]
    primary_findings = [f for f in findings if f.metric_role == MetricRole.PRIMARY]
    significant_primary = [f for f in primary_findings if f.is_significant]
    positive_primary = [f for f in significant_primary if f.direction == "positive"]
    negative_primary = [f for f in significant_primary if f.direction == "negative"]

    if guardrail_violations:
        violated = ", ".join(f.metric_name for f in guardrail_violations)
        return Recommendation(
            decision="don't ship",
            rationale=f"Guardrail violation(s) detected: {violated}. Do not ship until resolved.",
            caveats=["Investigate the guardrail regression before proceeding."],
        )

    if not significant_primary:
        return Recommendation(
            decision="needs more data",
            rationale="No primary metrics reached statistical significance. The experiment may be underpowered.",
            caveats=["Consider running longer or increasing sample size."],
        )

    if negative_primary and positive_primary:
        return Recommendation(
            decision="inconclusive",
            rationale="Primary metrics showed mixed results — some improved, some worsened.",
            caveats=["Review individual metric findings before deciding."],
        )

    if negative_primary:
        return Recommendation(
            decision="don't ship",
            rationale="Primary metrics showed statistically significant regressions.",
            caveats=["Review the negative findings before iterating."],
        )

    return Recommendation(
        decision="ship",
        rationale="All primary metrics improved with statistical significance and no guardrails were violated.",
        caveats=["Monitor metrics post-launch to confirm results hold at scale."],
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_findings.py -v
```
Expected: `11 passed`

- [ ] **Step 5: Commit**

```bash
git add xp_analyzer/findings.py tests/test_findings.py
git commit -m "feat: add findings generator and recommendation engine"
```

---

## Task 9: Markdown Renderer

**Files:**
- Create: `xp_analyzer/renderers/__init__.py`
- Create: `xp_analyzer/renderers/markdown.py`
- Create: `tests/test_renderers/test_markdown.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_renderers/test_markdown.py`:
```python
import pytest
from xp_analyzer.renderers.markdown import render_markdown
from xp_analyzer.models import (
    ExperimentResult, MetricResult, MetricType, MetricRole,
    Finding, Recommendation,
)


def make_result():
    return ExperimentResult(
        experiment_name="Free to Plus Test",
        control_group="0",
        treatment_groups=["1"],
        total_users=1000,
        metric_results=[
            MetricResult(
                metric_name="paid_conversion",
                metric_type=MetricType.BINARY,
                metric_role=MetricRole.PRIMARY,
                higher_is_better=True,
                control_mean=0.10,
                treatment_mean=0.115,
                relative_lift=0.15,
                absolute_lift=0.015,
                p_value=0.001,
                p_value_corrected=0.001,
                confidence_interval_low=0.005,
                confidence_interval_high=0.025,
                effect_size=1.2,
                is_significant=True,
                control_n=500,
                treatment_n=500,
            ),
            MetricResult(
                metric_name="paid_plan_canceled",
                metric_type=MetricType.BINARY,
                metric_role=MetricRole.GUARDRAIL,
                higher_is_better=False,
                control_mean=0.05,
                treatment_mean=0.048,
                relative_lift=-0.04,
                absolute_lift=-0.002,
                p_value=0.72,
                p_value_corrected=0.72,
                confidence_interval_low=-0.01,
                confidence_interval_high=0.006,
                effect_size=0.05,
                is_significant=False,
                control_n=500,
                treatment_n=500,
            ),
        ],
        findings=[
            Finding("paid_conversion", MetricRole.PRIMARY, True, "positive", "Conversion improved by 15%."),
            Finding("paid_plan_canceled", MetricRole.GUARDRAIL, False, "neutral", "Guardrail safe."),
        ],
        recommendation=Recommendation(
            decision="ship",
            rationale="All primary metrics improved.",
            caveats=["Monitor post-launch."],
        ),
    )


def test_markdown_contains_experiment_name():
    output = render_markdown(make_result())
    assert "Free to Plus Test" in output


def test_markdown_contains_recommendation_decision():
    output = render_markdown(make_result())
    assert "ship" in output.lower()


def test_markdown_contains_metric_names():
    output = render_markdown(make_result())
    assert "paid_conversion" in output
    assert "paid_plan_canceled" in output


def test_markdown_contains_p_values():
    output = render_markdown(make_result())
    assert "0.001" in output


def test_markdown_contains_lift_values():
    output = render_markdown(make_result())
    assert "15" in output  # 15% lift


def test_markdown_contains_findings_section():
    output = render_markdown(make_result())
    assert "## Findings" in output


def test_markdown_contains_recommendation_section():
    output = render_markdown(make_result())
    assert "## Recommendation" in output


def test_markdown_contains_caveats():
    output = render_markdown(make_result())
    assert "Monitor post-launch" in output


def test_markdown_contains_table_headers():
    output = render_markdown(make_result())
    assert "Control" in output
    assert "Treatment" in output
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_renderers/test_markdown.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Implement markdown renderer**

`xp_analyzer/renderers/__init__.py`: (empty)

`xp_analyzer/renderers/markdown.py`:
```python
from datetime import date
from xp_analyzer.models import ExperimentResult, MetricResult, MetricRole


def _format_pct(value: float) -> str:
    return f"{value:+.1%}"


def _format_mean(value: float, metric_type: str) -> str:
    if metric_type == "binary":
        return f"{value:.1%}"
    return f"{value:.2f}"


def _significance_marker(result: MetricResult) -> str:
    return "Yes" if result.is_significant else "No"


def _render_metric_table(result: MetricResult) -> str:
    ctrl = _format_mean(result.control_mean, result.metric_type.value)
    trt = _format_mean(result.treatment_mean, result.metric_type.value)
    lift = _format_pct(result.relative_lift) if result.relative_lift != float("inf") else "+inf"
    ci = f"[{_format_pct(result.confidence_interval_low)}, {_format_pct(result.confidence_interval_high)}]"
    sig = _significance_marker(result)
    role_label = f"({result.metric_role.value})"

    lines = [
        f"### {result.metric_name} {role_label}",
        "",
        f"| Metric | Control | Treatment | Difference |",
        f"|--------|---------|-----------|------------|",
        f"| Mean | {ctrl} | {trt} | {lift} |",
        f"| p-value (corrected) | — | — | {result.p_value_corrected:.4f} |",
        f"| 95% CI (absolute) | — | — | {ci} |",
        f"| Statistically significant | — | — | {sig} |",
        f"| n | {result.control_n:,} | {result.treatment_n:,} | — |",
        "",
    ]
    return "\n".join(lines)


def render_markdown(result: ExperimentResult) -> str:
    decision_emoji = {"ship": "✓", "don't ship": "✗", "needs more data": "?", "inconclusive": "~"}
    emoji = decision_emoji.get(result.recommendation.decision, "")

    sections = [
        f"# Experiment Report: {result.experiment_name}",
        "",
        f"**Generated:** {date.today()}  ",
        f"**Control Group:** {result.control_group}  ",
        f"**Treatment Group(s):** {', '.join(result.treatment_groups)}  ",
        f"**Total Users:** {result.total_users:,}",
        "",
        "---",
        "",
        "## Summary",
        "",
        f"**Recommendation: {result.recommendation.decision.upper()} {emoji}**",
        "",
        result.recommendation.rationale,
        "",
        "---",
        "",
        "## Results",
        "",
    ]

    for metric_result in result.metric_results:
        sections.append(_render_metric_table(metric_result))

    sections += [
        "---",
        "",
        "## Findings",
        "",
    ]
    for i, finding in enumerate(result.findings, start=1):
        sections.append(f"{i}. {finding.summary}")
    sections.append("")

    sections += [
        "---",
        "",
        "## Recommendation",
        "",
        f"**Decision: {result.recommendation.decision.upper()}**",
        "",
        f"**Rationale:** {result.recommendation.rationale}",
        "",
    ]
    if result.recommendation.caveats:
        sections.append("**Caveats:**")
        for caveat in result.recommendation.caveats:
            sections.append(f"- {caveat}")
        sections.append("")

    return "\n".join(sections)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_renderers/test_markdown.py -v
```
Expected: `9 passed`

- [ ] **Step 5: Commit**

```bash
git add xp_analyzer/renderers/ tests/test_renderers/test_markdown.py
git commit -m "feat: add markdown report renderer"
```

---

## Task 10: JSON Renderer

**Files:**
- Create: `xp_analyzer/renderers/json_renderer.py`
- Create: `tests/test_renderers/test_json_renderer.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_renderers/test_json_renderer.py`:
```python
import json
import pytest
from xp_analyzer.renderers.json_renderer import render_json
from xp_analyzer.models import (
    ExperimentResult, MetricResult, MetricType, MetricRole,
    Finding, Recommendation,
)

# Reuse the same make_result helper from test_markdown.py
from tests.test_renderers.test_markdown import make_result


def test_json_output_is_valid():
    output = render_json(make_result())
    parsed = json.loads(output)
    assert isinstance(parsed, dict)


def test_json_contains_required_top_level_keys():
    parsed = json.loads(render_json(make_result()))
    assert "experiment_name" in parsed
    assert "total_users" in parsed
    assert "metric_results" in parsed
    assert "findings" in parsed
    assert "recommendation" in parsed


def test_json_metric_result_structure():
    parsed = json.loads(render_json(make_result()))
    metric = parsed["metric_results"][0]
    assert metric["metric_name"] == "paid_conversion"
    assert metric["is_significant"] is True
    assert isinstance(metric["p_value"], float)
    assert isinstance(metric["relative_lift"], float)


def test_json_recommendation_structure():
    parsed = json.loads(render_json(make_result()))
    rec = parsed["recommendation"]
    assert rec["decision"] == "ship"
    assert isinstance(rec["caveats"], list)


def test_json_handles_inf_lift():
    # Make sure float("inf") doesn't crash JSON serialization
    result = make_result()
    result.metric_results[0].relative_lift = float("inf")
    output = render_json(result)
    parsed = json.loads(output)
    assert parsed["metric_results"][0]["relative_lift"] is None  # inf → null
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_renderers/test_json_renderer.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Implement JSON renderer**

`xp_analyzer/renderers/json_renderer.py`:
```python
import json
import math
from xp_analyzer.models import ExperimentResult


def _sanitize(obj):
    """Recursively replace inf/nan with None for valid JSON."""
    if isinstance(obj, float):
        if math.isinf(obj) or math.isnan(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj


def render_json(result: ExperimentResult) -> str:
    data = _sanitize(result.to_dict())
    return json.dumps(data, indent=2, default=str)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_renderers/test_json_renderer.py -v
```
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add xp_analyzer/renderers/json_renderer.py tests/test_renderers/test_json_renderer.py
git commit -m "feat: add JSON renderer with inf/nan sanitization"
```

---

## Task 11: CLI Entrypoint

**Files:**
- Create: `xp_analyzer/cli.py`

- [ ] **Step 1: Write the failing tests**

Add `tests/test_cli.py`:
```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_cli.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Implement CLI**

`xp_analyzer/cli.py`:
```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_cli.py -v
```
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add xp_analyzer/cli.py tests/test_cli.py
git commit -m "feat: add CLI entrypoint with markdown and JSON output"
```

---

## Task 12: Integration Test with Real Data

**Files:**
- Create: `tests/test_integration.py`
- Create: `xp_data/free_plus_config.yaml`

- [ ] **Step 1: Create config for the real CSV**

`xp_data/free_plus_config.yaml`:
```yaml
experiment_name: "Free to Plus Upgrade Experiment"
group_column: treatment
control_group: "0"
significance_threshold: 0.05
correction_method: bonferroni
metrics:
  - name: paid_conversion
    column: paid_signup_date
    type: binary
    role: primary
    higher_is_better: true
    derive: not_null
  - name: paid_plan_canceled
    column: paid_plan_canceled
    type: binary
    role: guardrail
    higher_is_better: false
```

- [ ] **Step 2: Write the integration test**

`tests/test_integration.py`:
```python
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
```

- [ ] **Step 3: Run integration tests**

```bash
pytest tests/test_integration.py -v
```
Expected: `2 passed`

- [ ] **Step 4: Run the tool manually and inspect output**

```bash
xp-analyzer --csv xp_data/free_plus_experiment.csv --config xp_data/free_plus_config.yaml
```
Expected: A readable Markdown report printed to terminal with results, findings, and a recommendation.

- [ ] **Step 5: Save a sample report**

```bash
xp-analyzer \
  --csv xp_data/free_plus_experiment.csv \
  --config xp_data/free_plus_config.yaml \
  --output xp_data/free_plus_report.md
```

- [ ] **Step 6: Run full test suite**

```bash
pytest tests/ -v
```
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add xp_data/free_plus_config.yaml tests/test_integration.py xp_data/free_plus_report.md
git commit -m "feat: integration test and config for real experiment data"
```

---

---

## Task 13: Interactive Setup Wizard (`xp-analyzer setup`)

**Purpose:** Guide the user through metrics alignment *before* running analysis — locking in success metrics, guardrails, and thresholds so results can't be reverse-engineered. Outputs a YAML config file.

**Wizard flow:**
```
$ xp-analyzer setup --csv xp_data/free_plus_experiment.csv

Columns found: user_id, assignment_date, treatment, assigned_on_platform, time_zone, paid_plan_canceled, paid_signup_date

Experiment name: Free to Plus Upgrade Experiment
Group column: treatment
  → Unique values: 0, 1
Control group value: 0

Classify each column (primary / guardrail / secondary / skip):

  paid_signup_date → role: primary
    Type (binary/continuous): binary
    Non-binary values detected (dates). Derive as binary (non-null=1)? [Y/n]: y
    Higher is better? [Y/n]: y
    Metric name [paid_signup_date]: paid_conversion

  paid_plan_canceled → role: guardrail
    Type (binary/continuous): binary
    Higher is better? [Y/n]: n

  assignment_date → role: skip
  assigned_on_platform → role: skip
  time_zone → role: skip

Significance threshold [0.05]: 
Correction method (bonferroni/benjamini-hochberg) [bonferroni]: 

Config saved to: xp_data/free_plus_experiment_config.yaml

Run your analysis:
  xp-analyzer --csv xp_data/free_plus_experiment.csv --config xp_data/free_plus_experiment_config.yaml
```

**Files:**
- Create: `xp_analyzer/setup_wizard.py`
- Modify: `xp_analyzer/cli.py`
- Create: `tests/test_setup_wizard.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_setup_wizard.py`:
```python
import pytest
import yaml
from pathlib import Path
from click.testing import CliRunner
from xp_analyzer.cli import setup

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_CSV = FIXTURES / "sample_with_dates.csv"


def run_setup(csv_path, user_input: str, output_path: str = None):
    runner = CliRunner()
    args = ["--csv", str(csv_path)]
    if output_path:
        args += ["--output", output_path]
    return runner.invoke(setup, args, input=user_input)


def test_setup_creates_config_file(tmp_path):
    out = str(tmp_path / "config.yaml")
    result = run_setup(
        SAMPLE_CSV,
        output_path=out,
        user_input="\n".join([
            "My Experiment",   # experiment name
            "treatment",       # group column
            "0",               # control group
            "primary",         # role for paid_signup_date
            "binary",          # type
            "y",               # derive not_null
            "y",               # higher is better
            "paid_conversion", # metric name
            "guardrail",       # role for paid_plan_canceled
            "binary",          # type
            "n",               # higher is better = False
            "",                # metric name (use column name)
            "skip",            # revenue
            "skip",            # conversion
            "skip",            # refund_rate
            "0.05",            # significance threshold
            "bonferroni",      # correction method
            "",                # confirm
        ])
    )
    assert result.exit_code == 0, result.output
    assert Path(out).exists()


def test_setup_config_has_correct_structure(tmp_path):
    out = str(tmp_path / "config.yaml")
    run_setup(
        SAMPLE_CSV,
        output_path=out,
        user_input="\n".join([
            "My Experiment",
            "treatment",
            "0",
            "primary", "binary", "y", "y", "paid_conversion",
            "guardrail", "binary", "n", "",
            "skip", "skip", "skip",
            "0.05", "bonferroni", "",
        ])
    )
    config = yaml.safe_load(Path(out).read_text())
    assert config["experiment_name"] == "My Experiment"
    assert config["group_column"] == "treatment"
    assert config["control_group"] == "0"
    assert len(config["metrics"]) == 2


def test_setup_primary_metric_fields(tmp_path):
    out = str(tmp_path / "config.yaml")
    run_setup(
        SAMPLE_CSV,
        output_path=out,
        user_input="\n".join([
            "My Experiment",
            "treatment",
            "0",
            "primary", "binary", "y", "y", "paid_conversion",
            "guardrail", "binary", "n", "",
            "skip", "skip", "skip",
            "0.05", "bonferroni", "",
        ])
    )
    config = yaml.safe_load(Path(out).read_text())
    primary = next(m for m in config["metrics"] if m["role"] == "primary")
    assert primary["name"] == "paid_conversion"
    assert primary["column"] == "paid_signup_date"
    assert primary["type"] == "binary"
    assert primary["derive"] == "not_null"
    assert primary["higher_is_better"] is True


def test_setup_guardrail_metric_fields(tmp_path):
    out = str(tmp_path / "config.yaml")
    run_setup(
        SAMPLE_CSV,
        output_path=out,
        user_input="\n".join([
            "My Experiment",
            "treatment",
            "0",
            "primary", "binary", "y", "y", "paid_conversion",
            "guardrail", "binary", "n", "",
            "skip", "skip", "skip",
            "0.05", "bonferroni", "",
        ])
    )
    config = yaml.safe_load(Path(out).read_text())
    guardrail = next(m for m in config["metrics"] if m["role"] == "guardrail")
    assert guardrail["column"] == "paid_plan_canceled"
    assert guardrail["higher_is_better"] is False
    assert guardrail.get("derive") is None


def test_setup_missing_csv_exits_nonzero():
    runner = CliRunner()
    result = runner.invoke(setup, ["--csv", "no_such.csv"])
    assert result.exit_code != 0


def test_setup_prints_run_instructions(tmp_path):
    out = str(tmp_path / "config.yaml")
    result = run_setup(
        SAMPLE_CSV,
        output_path=out,
        user_input="\n".join([
            "My Experiment",
            "treatment", "0",
            "primary", "binary", "y", "y", "paid_conversion",
            "guardrail", "binary", "n", "",
            "skip", "skip", "skip",
            "0.05", "bonferroni", "",
        ])
    )
    assert "xp-analyzer" in result.output
    assert "--config" in result.output
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_setup_wizard.py -v
```
Expected: `ImportError` (setup command doesn't exist yet)

- [ ] **Step 3: Implement setup_wizard.py**

`xp_analyzer/setup_wizard.py`:
```python
import pandas as pd
import yaml
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

        default_name = col
        name = click.prompt(f"    Metric name", default=default_name)

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
```

- [ ] **Step 4: Add setup command to cli.py**

Add to `xp_analyzer/cli.py` (after the `main` command):
```python
from xp_analyzer.setup_wizard import run_wizard


@click.command()
@click.option("--csv", "csv_path", required=True, help="Path to experiment CSV file")
@click.option("--output", "output_path", default=None, help="Where to save the config YAML (default: <csv_stem>_config.yaml)")
def setup(csv_path: str, output_path: str | None) -> None:
    """Interactively define experiment metrics and save a config file."""
    csv = Path(csv_path)
    if not csv.exists():
        click.echo(f"Error: CSV file not found: {csv}", err=True)
        sys.exit(1)

    config_dict = run_wizard(csv)

    out = Path(output_path) if output_path else csv.parent / f"{csv.stem}_config.yaml"
    with out.open("w") as f:
        yaml.dump(config_dict, f, default_flow_style=False, sort_keys=False)

    click.echo(f"\nConfig saved to: {out}")
    click.echo(f"\nRun your analysis:")
    click.echo(f"  xp-analyzer --csv {csv_path} --config {out}")
```

Also register both commands in a group at the bottom of `cli.py`:
```python
@click.group()
def cli():
    pass

cli.add_command(main, name="analyze")
cli.add_command(setup, name="setup")
```

And update `pyproject.toml` entry point:
```toml
[project.scripts]
xp-analyzer = "xp_analyzer.cli:cli"
```

> **Note:** After this change, the analyze command is invoked as `xp-analyzer analyze --csv ... --config ...`. Update the integration test in Task 12 accordingly — change `runner.invoke(main, ...)` to `runner.invoke(cli, ["analyze", ...])`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_setup_wizard.py -v
```
Expected: `6 passed`

- [ ] **Step 6: Run full test suite to catch any regressions**

```bash
pytest tests/ -v
```
Expected: All tests pass. (If integration tests break due to the CLI group refactor, update `runner.invoke(main, ...)` → `runner.invoke(cli, ["analyze", ...])` in `tests/test_cli.py` and `tests/test_integration.py`.)

- [ ] **Step 7: Manually test the wizard end-to-end**

```bash
xp-analyzer setup --csv xp_data/free_plus_experiment.csv --output xp_data/free_plus_experiment_config.yaml
```
Walk through the prompts, verify the output YAML is correct, then run:
```bash
xp-analyzer analyze --csv xp_data/free_plus_experiment.csv --config xp_data/free_plus_experiment_config.yaml
```
Expected: Full Markdown report printed to terminal.

- [ ] **Step 8: Commit**

```bash
git add xp_analyzer/setup_wizard.py xp_analyzer/cli.py pyproject.toml tests/test_setup_wizard.py
git commit -m "feat: add interactive setup wizard for metrics alignment"
```

---

## Self-Review

**Spec coverage:**
- CSV ingestion ✓ (Task 4)
- Interactive metrics alignment (setup wizard, locks in success metrics before analysis) ✓ (Task 13)
- Config/alignment phase (success metrics, guardrails, significance threshold, control group) ✓ (Tasks 2–3)
- Statistical analysis — continuous (t-test, Cohen's d, CI) ✓ (Task 5)
- Statistical analysis — binary (proportions z-test, relative risk, CI) ✓ (Task 6)
- Multiple comparison correction ✓ (Task 7)
- Findings generation ✓ (Task 8)
- Recommendations ✓ (Task 8)
- Markdown report output ✓ (Task 9)
- JSON output for Phase 2 readiness ✓ (Task 10)
- CLI interface with analyze + setup commands ✓ (Tasks 11, 13)
- Integration with real data ✓ (Task 12)
- Phase 2 (web frontend) — architecture is decoupled; `renderers/json_renderer.py` is the API response layer. No work needed in Phase 1.

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:** `MetricResult`, `Finding`, `Recommendation`, `ExperimentResult` defined in Task 2 and used consistently through Tasks 3–12. `MetricRole.PRIMARY` / `MetricRole.GUARDRAIL` used consistently. `render_markdown` / `render_json` signatures match CLI usage.
