# Guardrail Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `filter_by` subpopulation support to metrics and correlated guardrail detection that downgrades false-positive "don't ship" verdicts to "review guardrail".

**Architecture:** Six in-place changes across existing modules — models, loader, config, findings, setup wizard, and markdown renderer. No new pipeline steps, no new files except a YAML fixture. All changes are backward compatible: existing callers with one argument to `generate_recommendation` are unaffected, and configs without `filter_by` behave identically to today.

**Tech Stack:** Python 3.10+, pandas, click, pyyaml, pytest

---

## File Map

| File | Change |
|------|--------|
| `xp_analyzer/models.py` | Add `FilterBy` dataclass; add `filter_by` field to `MetricConfig` |
| `xp_analyzer/loader.py` | Add `_apply_filter()`; apply filter per metric when `filter_by` is set |
| `xp_analyzer/config.py` | Parse optional `filter_by` block from YAML |
| `xp_analyzer/findings.py` | Add `_same_raw_direction()`; add optional `metric_results` param to `generate_recommendation()`; correlated detection logic |
| `xp_analyzer/cli.py` | Pass `metric_results` to `generate_recommendation()` |
| `xp_analyzer/setup_wizard.py` | After derive prompt, ask filter_by question |
| `xp_analyzer/renderers/markdown.py` | Add `"review guardrail"` to `decision_emoji` |
| `tests/test_models.py` | New tests for `FilterBy` and `MetricConfig.filter_by` |
| `tests/test_loader.py` | New tests for filter behaviour, filtered n, missing column, unknown condition |
| `tests/test_config.py` | New tests for filter_by YAML parsing and validation |
| `tests/test_findings.py` | New tests for correlated/uncorrelated/mixed guardrail outcomes |
| `tests/test_setup_wizard.py` | Update `FULL_INPUT`; add filter_by wizard test |
| `tests/test_renderers/test_markdown.py` | New test for "review guardrail" emoji |
| `tests/test_integration.py` | Include "review guardrail" in valid decisions |
| `tests/fixtures/sample_config_with_filter.yaml` | New fixture with `filter_by` block |

---

## Task 1: `FilterBy` dataclass + `MetricConfig.filter_by` field

**Files:**
- Modify: `xp_analyzer/models.py`
- Modify: `tests/test_models.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_models.py`:

```python
from xp_analyzer.models import FilterBy  # add to existing import line

def test_filter_by_dataclass():
    fb = FilterBy(column="paid_signup_date", condition="not_null")
    assert fb.column == "paid_signup_date"
    assert fb.condition == "not_null"


def test_metric_config_filter_by_defaults_none():
    m = MetricConfig(name="cvr", column="cvr", type=MetricType.BINARY, role=MetricRole.PRIMARY)
    assert m.filter_by is None


def test_metric_config_accepts_filter_by():
    fb = FilterBy(column="paid_signup_date", condition="not_null")
    m = MetricConfig(
        name="canceled",
        column="paid_plan_canceled",
        type=MetricType.BINARY,
        role=MetricRole.GUARDRAIL,
        filter_by=fb,
    )
    assert m.filter_by is fb
    assert m.filter_by.condition == "not_null"
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
pytest tests/test_models.py::test_filter_by_dataclass tests/test_models.py::test_metric_config_filter_by_defaults_none tests/test_models.py::test_metric_config_accepts_filter_by -v
```

Expected: FAIL — `ImportError: cannot import name 'FilterBy'`

- [ ] **Step 3: Add `FilterBy` to `models.py` and `filter_by` field to `MetricConfig`**

In `xp_analyzer/models.py`, add the `FilterBy` dataclass immediately before `MetricConfig` (after line 24, before line 27):

```python
@dataclass
class FilterBy:
    column: str
    condition: str  # supported: "not_null"
```

Then add `filter_by: Optional[FilterBy] = None` as the last field of `MetricConfig`:

```python
@dataclass
class MetricConfig:
    name: str
    column: str
    type: MetricType
    role: MetricRole
    higher_is_better: bool = True
    derive: Optional[str] = None  # "not_null" | None
    filter_by: Optional[FilterBy] = None  # new
```

Also update the `Recommendation` comment on line 68 to document the new valid value:

```python
@dataclass
class Recommendation:
    decision: str  # "ship" | "don't ship" | "needs more data" | "inconclusive" | "review guardrail"
    rationale: str
    caveats: list[str] = field(default_factory=list)
```

- [ ] **Step 4: Run the new tests to confirm they pass**

```bash
pytest tests/test_models.py::test_filter_by_dataclass tests/test_models.py::test_metric_config_filter_by_defaults_none tests/test_models.py::test_metric_config_accepts_filter_by -v
```

Expected: PASS

- [ ] **Step 5: Run the full test suite to confirm nothing regressed**

```bash
pytest --tb=short -q
```

Expected: all previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add xp_analyzer/models.py tests/test_models.py
git commit -m "feat: add FilterBy dataclass and MetricConfig.filter_by field"
```

---

## Task 2: `_apply_filter` helper + filter in loader

**Files:**
- Modify: `xp_analyzer/loader.py`
- Modify: `tests/test_loader.py`

The fixture `tests/fixtures/sample_with_dates.csv` already has the shape we need:

```
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

When we filter `paid_plan_canceled` by `paid_signup_date not_null`:
- Control: u2 (0), u4 (0) → values `[0, 0]`, n=2
- Treatment: u6 (0), u7 (0), u9 (0) → values `[0, 0, 0]`, n=3

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_loader.py`:

```python
from xp_analyzer.models import FilterBy  # add to existing import line


def test_filter_by_returns_filtered_values():
    config = make_config([
        MetricConfig(
            name="canceled",
            column="paid_plan_canceled",
            type=MetricType.BINARY,
            role=MetricRole.GUARDRAIL,
            higher_is_better=False,
            filter_by=FilterBy(column="paid_signup_date", condition="not_null"),
        ),
    ])
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    # Only users with a paid_signup_date (converters) are included
    assert groups["0"]["canceled"] == [0, 0]
    assert groups["1"]["canceled"] == [0, 0, 0]


def test_filter_by_reports_filtered_n():
    config = make_config([
        MetricConfig(
            name="canceled",
            column="paid_plan_canceled",
            type=MetricType.BINARY,
            role=MetricRole.GUARDRAIL,
            higher_is_better=False,
            filter_by=FilterBy(column="paid_signup_date", condition="not_null"),
        ),
    ])
    groups = load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
    assert len(groups["0"]["canceled"]) == 2   # 2 converters in control
    assert len(groups["1"]["canceled"]) == 3   # 3 converters in treatment


def test_filter_by_missing_column_raises():
    config = make_config([
        MetricConfig(
            name="canceled",
            column="paid_plan_canceled",
            type=MetricType.BINARY,
            role=MetricRole.GUARDRAIL,
            filter_by=FilterBy(column="nonexistent_col", condition="not_null"),
        ),
    ])
    with pytest.raises(ValueError, match="Filter column 'nonexistent_col' not found in CSV"):
        load_experiment_data(FIXTURES / "sample_with_dates.csv", config)


def test_filter_by_unknown_condition_raises():
    config = make_config([
        MetricConfig(
            name="canceled",
            column="paid_plan_canceled",
            type=MetricType.BINARY,
            role=MetricRole.GUARDRAIL,
            filter_by=FilterBy(column="paid_signup_date", condition="is_truthy"),
        ),
    ])
    with pytest.raises(ValueError, match="Unknown filter condition: 'is_truthy'"):
        load_experiment_data(FIXTURES / "sample_with_dates.csv", config)
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
pytest tests/test_loader.py::test_filter_by_returns_filtered_values tests/test_loader.py::test_filter_by_reports_filtered_n tests/test_loader.py::test_filter_by_missing_column_raises tests/test_loader.py::test_filter_by_unknown_condition_raises -v
```

Expected: FAIL — `ImportError: cannot import name 'FilterBy'` from loader (it's not imported yet) or AttributeError.

- [ ] **Step 3: Implement `_apply_filter` and update loader**

Replace the contents of `xp_analyzer/loader.py` with:

```python
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
```

- [ ] **Step 4: Run the new tests to confirm they pass**

```bash
pytest tests/test_loader.py::test_filter_by_returns_filtered_values tests/test_loader.py::test_filter_by_reports_filtered_n tests/test_loader.py::test_filter_by_missing_column_raises tests/test_loader.py::test_filter_by_unknown_condition_raises -v
```

Expected: PASS

- [ ] **Step 5: Run the full test suite**

```bash
pytest --tb=short -q
```

Expected: all previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add xp_analyzer/loader.py tests/test_loader.py
git commit -m "feat: add filter_by support to loader"
```

---

## Task 3: Parse `filter_by` in config loader

**Files:**
- Modify: `xp_analyzer/config.py`
- Modify: `tests/test_config.py`
- Create: `tests/fixtures/sample_config_with_filter.yaml`

- [ ] **Step 1: Create the fixture YAML**

Create `tests/fixtures/sample_config_with_filter.yaml`:

```yaml
# Use with tests/fixtures/sample_with_dates.csv
experiment_name: "Filter Test Experiment"
group_column: treatment
control_group: "0"
significance_threshold: 0.05
correction_method: bonferroni
metrics:
  - name: paid_plan_canceled
    column: paid_plan_canceled
    type: binary
    role: guardrail
    higher_is_better: false
    filter_by:
      column: paid_signup_date
      condition: not_null
```

- [ ] **Step 2: Write the failing tests**

Add to `tests/test_config.py`:

```python
from xp_analyzer.models import FilterBy  # add to existing import line


def test_load_config_parses_filter_by():
    config = load_config(FIXTURES / "sample_config_with_filter.yaml")
    guardrail = config.metrics[0]
    assert guardrail.filter_by is not None
    assert isinstance(guardrail.filter_by, FilterBy)
    assert guardrail.filter_by.column == "paid_signup_date"
    assert guardrail.filter_by.condition == "not_null"


def test_load_config_filter_by_none_when_absent():
    config = load_config(FIXTURES / "sample_config.yaml")
    # existing sample_config.yaml has no filter_by — should be None
    for metric in config.metrics:
        assert metric.filter_by is None


def test_load_config_filter_by_missing_column_key_raises(tmp_path):
    bad = tmp_path / "bad.yaml"
    bad.write_text(
        "experiment_name: test\n"
        "group_column: treatment\n"
        "control_group: '0'\n"
        "metrics:\n"
        "  - name: m\n"
        "    column: c\n"
        "    type: binary\n"
        "    role: primary\n"
        "    filter_by:\n"
        "      condition: not_null\n"  # missing 'column'
    )
    with pytest.raises(ValueError, match="filter_by missing required key: 'column'"):
        load_config(bad)


def test_load_config_filter_by_missing_condition_key_raises(tmp_path):
    bad = tmp_path / "bad.yaml"
    bad.write_text(
        "experiment_name: test\n"
        "group_column: treatment\n"
        "control_group: '0'\n"
        "metrics:\n"
        "  - name: m\n"
        "    column: c\n"
        "    type: binary\n"
        "    role: primary\n"
        "    filter_by:\n"
        "      column: paid_signup_date\n"  # missing 'condition'
    )
    with pytest.raises(ValueError, match="filter_by missing required key: 'condition'"):
        load_config(bad)
```

- [ ] **Step 3: Run the new tests to confirm they fail**

```bash
pytest tests/test_config.py::test_load_config_parses_filter_by tests/test_config.py::test_load_config_filter_by_none_when_absent tests/test_config.py::test_load_config_filter_by_missing_column_key_raises tests/test_config.py::test_load_config_filter_by_missing_condition_key_raises -v
```

Expected: FAIL — config loader doesn't parse `filter_by` yet.

- [ ] **Step 4: Update `config.py` to parse `filter_by`**

Replace the metrics list comprehension (lines 19–29) with:

```python
from xp_analyzer.models import ExperimentConfig, MetricConfig, MetricType, MetricRole, FilterBy
```

And update the metrics parsing block:

```python
    metrics = []
    for m in data["metrics"]:
        filter_by_data = m.get("filter_by")
        if filter_by_data is not None:
            for key in ("column", "condition"):
                if key not in filter_by_data:
                    raise ValueError(f"filter_by missing required key: '{key}'")
            filter_by = FilterBy(
                column=filter_by_data["column"],
                condition=filter_by_data["condition"],
            )
        else:
            filter_by = None

        metrics.append(MetricConfig(
            name=m["name"],
            column=m["column"],
            type=MetricType(m["type"]),
            role=MetricRole(m["role"]),
            higher_is_better=m.get("higher_is_better", True),
            derive=m.get("derive"),
            filter_by=filter_by,
        ))
```

The full updated `xp_analyzer/config.py`:

```python
from pathlib import Path
import yaml
from xp_analyzer.models import ExperimentConfig, MetricConfig, MetricType, MetricRole, FilterBy


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

    metrics = []
    for m in data["metrics"]:
        filter_by_data = m.get("filter_by")
        if filter_by_data is not None:
            for key in ("column", "condition"):
                if key not in filter_by_data:
                    raise ValueError(f"filter_by missing required key: '{key}'")
            filter_by = FilterBy(
                column=filter_by_data["column"],
                condition=filter_by_data["condition"],
            )
        else:
            filter_by = None

        metrics.append(MetricConfig(
            name=m["name"],
            column=m["column"],
            type=MetricType(m["type"]),
            role=MetricRole(m["role"]),
            higher_is_better=m.get("higher_is_better", True),
            derive=m.get("derive"),
            filter_by=filter_by,
        ))

    return ExperimentConfig(
        experiment_name=data["experiment_name"],
        group_column=data["group_column"],
        control_group=str(data["control_group"]),
        metrics=metrics,
        significance_threshold=data.get("significance_threshold", 0.05),
        correction_method=data.get("correction_method", "bonferroni"),
    )
```

- [ ] **Step 5: Run the new tests to confirm they pass**

```bash
pytest tests/test_config.py::test_load_config_parses_filter_by tests/test_config.py::test_load_config_filter_by_none_when_absent tests/test_config.py::test_load_config_filter_by_missing_column_key_raises tests/test_config.py::test_load_config_filter_by_missing_condition_key_raises -v
```

Expected: PASS

- [ ] **Step 6: Run the full test suite**

```bash
pytest --tb=short -q
```

Expected: all previously-passing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add xp_analyzer/config.py tests/test_config.py tests/fixtures/sample_config_with_filter.yaml
git commit -m "feat: parse filter_by block in config loader"
```

---

## Task 4: Correlated guardrail detection + CLI update

**Files:**
- Modify: `xp_analyzer/findings.py`
- Modify: `xp_analyzer/cli.py`
- Modify: `tests/test_findings.py`
- Modify: `tests/test_integration.py`

The logic: if `metric_results` is provided to `generate_recommendation`, check each guardrail violation against significant primary results. If ALL violations share direction with at least one significant primary → return `"review guardrail"`. If ANY violation has no correlated primary → return `"don't ship"` as usual.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_findings.py`:

```python
def test_correlated_guardrail_returns_review_guardrail():
    # Guardrail and primary both went UP (positive lift) — correlated
    primary_result = make_result("paid_conversion", MetricRole.PRIMARY, True, 0.214)
    guardrail_result = make_result("paid_plan_canceled", MetricRole.GUARDRAIL, True, 0.225, higher_is_better=False)
    findings = generate_findings([primary_result, guardrail_result])
    rec = generate_recommendation(findings, metric_results=[primary_result, guardrail_result])
    assert rec.decision == "review guardrail"
    assert "paid_plan_canceled" in rec.rationale
    assert "paid_conversion" in rec.rationale


def test_uncorrelated_guardrail_stays_dont_ship():
    # Primary went UP (+0.214), guardrail (higher_is_better=True) went DOWN (-0.10).
    # Opposite directions → not correlated → genuine "don't ship".
    primary_result = make_result("paid_conversion", MetricRole.PRIMARY, True, 0.214)
    guardrail_result = make_result("revenue_per_user", MetricRole.GUARDRAIL, True, -0.10, higher_is_better=True)
    findings = generate_findings([primary_result, guardrail_result])
    rec = generate_recommendation(findings, metric_results=[primary_result, guardrail_result])
    assert rec.decision == "don't ship"


def test_mixed_guardrails_one_correlated_one_not_stays_dont_ship():
    # Two violations: one correlated with primary, one not
    primary_result = make_result("paid_conversion", MetricRole.PRIMARY, True, 0.214)
    correlated_guardrail = make_result("paid_plan_canceled", MetricRole.GUARDRAIL, True, 0.225, higher_is_better=False)
    uncorrelated_guardrail = make_result("revenue_per_user", MetricRole.GUARDRAIL, True, -0.10, higher_is_better=True)
    findings = generate_findings([primary_result, correlated_guardrail, uncorrelated_guardrail])
    rec = generate_recommendation(
        findings,
        metric_results=[primary_result, correlated_guardrail, uncorrelated_guardrail],
    )
    assert rec.decision == "don't ship"


def test_generate_recommendation_backward_compatible_no_metric_results():
    # Called with one argument (old signature) — correlated check is skipped
    findings = [
        Finding("paid_plan_canceled", MetricRole.GUARDRAIL, is_significant=True, direction="negative", summary="violation"),
    ]
    rec = generate_recommendation(findings)
    assert rec.decision == "don't ship"
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
pytest tests/test_findings.py::test_correlated_guardrail_returns_review_guardrail tests/test_findings.py::test_uncorrelated_guardrail_stays_dont_ship tests/test_findings.py::test_mixed_guardrails_one_correlated_one_not_stays_dont_ship tests/test_findings.py::test_generate_recommendation_backward_compatible_no_metric_results -v
```

Expected: FAIL — `generate_recommendation` doesn't accept `metric_results` yet.

- [ ] **Step 3: Implement correlated guardrail detection in `findings.py`**

Replace `xp_analyzer/findings.py` with:

```python
from xp_analyzer.models import MetricResult, MetricRole, Finding, Recommendation


def _is_improvement(relative_lift: float, higher_is_better: bool) -> bool:
    if relative_lift == float("inf"):
        return higher_is_better
    if higher_is_better:
        return relative_lift > 0
    return relative_lift < 0


def _format_lift(relative_lift: float) -> str:
    if relative_lift == float("inf"):
        return "+inf"
    return f"{relative_lift:+.1%}"


def _same_raw_direction(guardrail: MetricResult, primary: MetricResult) -> bool:
    """True if guardrail and primary moved in the same raw direction (both up or both down)."""
    return (guardrail.relative_lift > 0) == (primary.relative_lift > 0)


def generate_findings(metric_results: list[MetricResult]) -> list[Finding]:
    findings = []
    for r in metric_results:
        lift_str = _format_lift(r.relative_lift)
        if not r.is_significant:
            direction = "neutral"
            summary = (
                f"{r.metric_name} showed no statistically significant change "
                f"(p={r.p_value_corrected:.3f}, lift={lift_str})."
            )
        elif _is_improvement(r.relative_lift, r.higher_is_better):
            direction = "positive"
            summary = (
                f"{r.metric_name} improved by {lift_str} "
                f"(p={r.p_value_corrected:.3f}), a statistically significant win."
            )
        else:
            direction = "negative"
            label = "guardrail violation" if r.metric_role == MetricRole.GUARDRAIL else "regression"
            summary = (
                f"{r.metric_name} worsened by {lift_str} "
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


def generate_recommendation(
    findings: list[Finding],
    metric_results: list[MetricResult] | None = None,
) -> Recommendation:
    guardrail_violations = [
        f for f in findings
        if f.metric_role == MetricRole.GUARDRAIL and f.is_significant and f.direction == "negative"
    ]
    primary_findings = [f for f in findings if f.metric_role == MetricRole.PRIMARY]
    significant_primary = [f for f in primary_findings if f.is_significant]
    positive_primary = [f for f in significant_primary if f.direction == "positive"]
    negative_primary = [f for f in significant_primary if f.direction == "negative"]

    if guardrail_violations:
        # When metric_results are available, check for correlation with significant primary metrics
        if metric_results is not None:
            sig_primary_results = [
                r for r in metric_results
                if r.metric_role == MetricRole.PRIMARY and r.is_significant
            ]
            if sig_primary_results:
                violation_names = {f.metric_name for f in guardrail_violations}
                guardrail_results = [
                    r for r in metric_results if r.metric_name in violation_names
                ]
                all_correlated = all(
                    any(_same_raw_direction(g, p) for p in sig_primary_results)
                    for g in guardrail_results
                )
                if all_correlated:
                    pairs = []
                    for g in guardrail_results:
                        for p in sig_primary_results:
                            if _same_raw_direction(g, p):
                                pairs.append(f"{g.metric_name} increased alongside {p.metric_name}")
                    pair_str = "; ".join(pairs)
                    return Recommendation(
                        decision="review guardrail",
                        rationale=(
                            f"{pair_str} — this may reflect volume growth rather than quality "
                            f"degradation. Verify the metric rate among the affected population "
                            f"before deciding."
                        ),
                        caveats=[
                            "Verify the guardrail metric rate within the affected subpopulation "
                            "before making a ship decision."
                        ],
                    )

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

- [ ] **Step 4: Update `cli.py` to pass `metric_results` to `generate_recommendation`**

In `xp_analyzer/cli.py`, change line 42 from:

```python
        recommendation = generate_recommendation(findings)
```

to:

```python
        recommendation = generate_recommendation(findings, metric_results=metric_results)
```

- [ ] **Step 5: Update `test_integration.py` to allow "review guardrail"**

In `tests/test_integration.py`, update the valid decisions check on line 32 from:

```python
    assert data["recommendation"]["decision"] in ["ship", "don't ship", "needs more data", "inconclusive"]
```

to:

```python
    assert data["recommendation"]["decision"] in ["ship", "don't ship", "needs more data", "inconclusive", "review guardrail"]
```

- [ ] **Step 6: Run the new findings tests to confirm they pass**

```bash
pytest tests/test_findings.py::test_correlated_guardrail_returns_review_guardrail tests/test_findings.py::test_uncorrelated_guardrail_stays_dont_ship tests/test_findings.py::test_mixed_guardrails_one_correlated_one_not_stays_dont_ship tests/test_findings.py::test_generate_recommendation_backward_compatible_no_metric_results -v
```

Expected: PASS

- [ ] **Step 7: Run the full test suite**

```bash
pytest --tb=short -q
```

Expected: all tests pass. Note: the integration test will now get "review guardrail" for the free_plus experiment (paid_plan_canceled is correlated with paid_conversion), which is now a valid decision.

- [ ] **Step 8: Commit**

```bash
git add xp_analyzer/findings.py xp_analyzer/cli.py tests/test_findings.py tests/test_integration.py
git commit -m "feat: correlated guardrail detection — downgrade to 'review guardrail' when violation tracks primary"
```

---

## Task 5: Setup wizard filter_by prompts

**Files:**
- Modify: `xp_analyzer/setup_wizard.py`
- Modify: `tests/test_setup_wizard.py`

The wizard already asks: role → type → derive → higher_is_better → name.
New step after derive: "Filter to a subset of users? [y/N]" — if yes, prompt for column and condition.

Existing tests use `FULL_INPUT` which has a specific sequence of inputs. Adding two new prompts (one per non-skipped metric) means we need to insert `"n"` for each metric in the existing `FULL_INPUT` and update `test_setup_wizard.py`.

- [ ] **Step 1: Update `FULL_INPUT` and add a new filter test in `test_setup_wizard.py`**

Replace the `FULL_INPUT` constant and add a new test. The full updated `tests/test_setup_wizard.py`:

```python
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
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
pytest tests/test_setup_wizard.py -v
```

Expected: existing tests likely fail because the new filter prompts are missing from the wizard (inputs get out of sync), and the new test fails because filter_by isn't prompted yet.

- [ ] **Step 3: Add filter_by prompts to `setup_wizard.py`**

In `xp_analyzer/setup_wizard.py`, replace the per-metric loop body. The full updated file:

```python
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

        filter_by = None
        if click.confirm("    Filter to a subset of users?", default=False):
            filter_col = click.prompt(
                "      Filter column",
                type=click.Choice(all_columns),
            )
            condition = click.prompt(
                "      Condition",
                type=click.Choice(["not_null"]),
            )
            filter_by = {"column": filter_col, "condition": condition}

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
        if filter_by:
            entry["filter_by"] = filter_by
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

- [ ] **Step 4: Run the setup wizard tests to confirm they pass**

```bash
pytest tests/test_setup_wizard.py -v
```

Expected: PASS

- [ ] **Step 5: Run the full test suite**

```bash
pytest --tb=short -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add xp_analyzer/setup_wizard.py tests/test_setup_wizard.py
git commit -m "feat: add filter_by prompts to setup wizard"
```

---

## Task 6: Markdown renderer "review guardrail" emoji

**Files:**
- Modify: `xp_analyzer/renderers/markdown.py`
- Modify: `tests/test_renderers/test_markdown.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_renderers/test_markdown.py`:

```python
def test_markdown_review_guardrail_renders_with_warning_emoji():
    result = make_result()
    result.recommendation = Recommendation(
        decision="review guardrail",
        rationale="paid_plan_canceled increased alongside paid_conversion — may reflect volume growth.",
        caveats=["Verify rate among converters."],
    )
    output = render_markdown(result)
    assert "⚠" in output
    assert "review guardrail" in output.lower()
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pytest tests/test_renderers/test_markdown.py::test_markdown_review_guardrail_renders_with_warning_emoji -v
```

Expected: FAIL — "review guardrail" maps to `""` (no emoji) since it's not in `decision_emoji`.

- [ ] **Step 3: Add "review guardrail" to `decision_emoji` in `markdown.py`**

In `xp_analyzer/renderers/markdown.py`, change line 43 from:

```python
    decision_emoji = {"ship": "✓", "don't ship": "✗", "needs more data": "?", "inconclusive": "~"}
```

to:

```python
    decision_emoji = {
        "ship": "✓",
        "don't ship": "✗",
        "needs more data": "?",
        "inconclusive": "~",
        "review guardrail": "⚠",
    }
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pytest tests/test_renderers/test_markdown.py::test_markdown_review_guardrail_renders_with_warning_emoji -v
```

Expected: PASS

- [ ] **Step 5: Run the full test suite**

```bash
pytest --tb=short -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add xp_analyzer/renderers/markdown.py tests/test_renderers/test_markdown.py
git commit -m "feat: add 'review guardrail' ⚠ to markdown renderer"
```

---

## Final Verification

- [ ] **Run the complete test suite one last time**

```bash
pytest -v
```

Expected: all tests pass with no failures.

- [ ] **Run the real experiment to confirm the new recommendation**

```bash
python -m xp_analyzer.cli analyze --csv xp_data/free_plus_experiment.csv --config xp_data/free_plus_config.yaml
```

Expected: recommendation is now `REVIEW GUARDRAIL ⚠` rather than `DON'T SHIP ✗`, with rationale naming the paid_plan_canceled / paid_conversion correlation.
