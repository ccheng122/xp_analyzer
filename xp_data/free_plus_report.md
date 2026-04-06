# Experiment Report: Free to Plus Upgrade Experiment

**Generated:** 2026-04-05  
**Control Group:** 0  
**Treatment Group(s):** 1  
**Total Users:** 30,000

---

## Summary

**Recommendation: DON'T SHIP ✗**

Guardrail violation(s) detected: paid_plan_canceled. Do not ship until resolved.

---

## Results

### paid_conversion (primary)

| Metric | Control | Treatment | Difference |
|--------|---------|-----------|------------|
| Mean | 8.0% | 9.7% | +21.4% |
| p-value (corrected) | — | — | 0.0000 |
| 95% CI (absolute) | — | — | [+1.0%, +2.4%] |
| Statistically significant | — | — | Yes |
| n | 20,000 | 10,000 | — |

### paid_plan_canceled (guardrail)

| Metric | Control | Treatment | Difference |
|--------|---------|-----------|------------|
| Mean | 4.0% | 4.9% | +22.5% |
| p-value (corrected) | — | — | 0.0003 |
| 95% CI (absolute) | — | — | [+0.4%, +1.4%] |
| Statistically significant | — | — | Yes |
| n | 20,000 | 10,000 | — |

---

## Findings

1. paid_conversion improved by +21.4% (p=0.000), a statistically significant win.
2. paid_plan_canceled worsened by +22.5% (p=0.000) — guardrail violation.

---

## Recommendation

**Decision: DON'T SHIP**

**Rationale:** Guardrail violation(s) detected: paid_plan_canceled. Do not ship until resolved.

**Caveats:**
- Investigate the guardrail regression before proceeding.
