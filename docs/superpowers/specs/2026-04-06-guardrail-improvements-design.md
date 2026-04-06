# Guardrail Improvements Design

**Date:** 2026-04-06  
**Status:** Approved

## Problem

The current guardrail logic has a false-positive failure mode: when a primary metric (e.g. conversion rate) improves significantly, a guardrail metric that tracks downstream behavior on converters (e.g. cancellation rate) will mechanically increase in absolute terms — not because quality degraded, but because more users entered the funnel. The tool incorrectly recommends "don't ship" in this case.

This was observed in the free-to-plus experiment: paid conversion rose +21.4% and paid_plan_canceled rose +22.5%, but cancellation rate among converters was identical between groups (~50% each). The guardrail fired on volume, not quality.

Two complementary fixes:

1. **`filter_by`** — let metrics be computed on a filtered subpopulation (e.g. converters only), so the denominator is correct from the start.
2. **Correlated guardrail detection** — automatically detect when a guardrail moves in the same raw direction as a primary metric, and downgrade the recommendation from "don't ship" to "review guardrail" with an explanatory message.

---

## Approach

Minimal in-place changes to existing modules. No new pipeline steps. Both features are backward compatible — existing configs and tests are unaffected.

---

## Data Model (`models.py`)

Add a `FilterBy` dataclass:

```python
@dataclass
class FilterBy:
    column: str
    condition: str  # supported: "not_null"
```

Add optional `filter_by` field to `MetricConfig`:

```python
@dataclass
class MetricConfig:
    name: str
    column: str
    type: MetricType
    role: MetricRole
    higher_is_better: bool = True
    derive: Optional[str] = None
    filter_by: Optional[FilterBy] = None  # new
```

Add `"review guardrail"` as a valid `Recommendation.decision` value alongside the existing four (`"ship"`, `"don't ship"`, `"needs more data"`, `"inconclusive"`).

---

## Loader (`loader.py`)

Add a helper:

```python
def _apply_filter(df: pd.DataFrame, filter_by: FilterBy) -> pd.Series:
    if filter_by.condition == "not_null":
        return df[filter_by.column].notna()
    raise ValueError(f"Unknown filter condition: '{filter_by.condition}'")
```

When a metric has `filter_by`, apply the mask to the group DataFrame before extracting values. The filter column must exist in the CSV — raise `ValueError: "Filter column '{col}' not found in CSV"` if not.

`MetricResult.control_n` and `treatment_n` reflect the filtered population size, not the full group size, so reported sample sizes accurately represent the analysis population.

**YAML config example:**

```yaml
- name: paid_plan_canceled
  column: paid_plan_canceled
  type: binary
  role: guardrail
  higher_is_better: false
  filter_by:
    column: paid_signup_date
    condition: not_null
```

---

## Config Loader (`config.py`)

Parse the optional `filter_by` block from YAML. If present, validate that both `column` and `condition` keys exist — raise `ValueError: "filter_by missing required key: '{key}'"` if either is absent.

```python
filter_by_data = m.get("filter_by")
filter_by = FilterBy(
    column=filter_by_data["column"],
    condition=filter_by_data["condition"],
) if filter_by_data else None
```

---

## Findings & Recommendation (`findings.py`)

### Signature change

`generate_recommendation` gains an optional second parameter:

```python
def generate_recommendation(
    findings: list[Finding],
    metric_results: list[MetricResult] | None = None,
) -> Recommendation:
```

Backward compatible — existing callers with one argument are unaffected.

### Correlation detection

Add a helper:

```python
def _same_raw_direction(guardrail: MetricResult, primary: MetricResult) -> bool:
    return (guardrail.relative_lift > 0) == (primary.relative_lift > 0)
```

Before returning `"don't ship"` for guardrail violations, check each violation against significant primary metrics:

- If **all** guardrail violations are correlated with at least one significant primary metric → recommendation is `"review guardrail"`
- If **any** guardrail violation has no correlated primary metric (genuinely independent worsening) → recommendation stays `"don't ship"`

### "review guardrail" rationale

Names the correlated pairs explicitly. Example:

> *"paid_plan_canceled increased alongside paid_conversion — this may reflect volume growth rather than quality degradation. Verify the metric rate among the converter population before deciding."*

### Decision priority order (unchanged except for new case)

1. Any unambiguous guardrail violation (no correlation) → `"don't ship"`
2. All guardrail violations are correlated with a primary → `"review guardrail"`
3. No significant primary metrics → `"needs more data"`
4. Mixed significant primary metrics → `"inconclusive"`
5. All primary metrics improved → `"ship"`

---

## Setup Wizard (`setup_wizard.py`)

After the derive prompt for each non-skipped metric, ask:

```
Filter to a subset of users? [y/N]:
```

If yes:
```
  Filter column: <click.Choice from CSV columns>
  Condition (not_null): <click.Choice(["not_null"])>
```

Only `"not_null"` is supported. Using `click.Choice` keeps the wizard self-documenting and prevents invalid input.

---

## Markdown Renderer (`renderers/markdown.py`)

Add `"review guardrail"` to the decision emoji map:

```python
decision_emoji = {
    "ship": "✓",
    "don't ship": "✗",
    "needs more data": "?",
    "inconclusive": "~",
    "review guardrail": "⚠",
}
```

No other renderer changes needed.

---

## Testing

Each change gets new tests following the existing TDD pattern:

- `test_models.py` — `FilterBy` dataclass, `MetricConfig.filter_by` default None
- `test_loader.py` — filter applied correctly, filtered n values, missing filter column raises, unknown condition raises
- `test_config.py` — parses filter_by block, validates required keys, None when absent
- `test_findings.py` — correlated guardrail → "review guardrail", uncorrelated guardrail → "don't ship", mixed (one correlated, one not) → "don't ship"
- `test_renderers/test_markdown.py` — "review guardrail" decision rendered with ⚠
- `test_setup_wizard.py` — filter_by prompts produce correct config output

All existing tests must continue to pass.

---

## Spec Self-Review

**Placeholders:** None.

**Consistency:** `generate_recommendation` signature change is backward compatible. `FilterBy` is referenced consistently across models, loader, config, wizard. Decision priority order accounts for the new "review guardrail" case without ambiguity.

**Scope:** Focused. No unrelated refactoring. Both features touch only the files they need to.

**Ambiguity:** The "all vs any" guardrail correlation rule is explicit — if any violation is uncorrelated, the hard "don't ship" stands. This is the conservative choice and is stated clearly.
