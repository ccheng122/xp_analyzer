from typing import Optional
import numpy as np
from scipy import stats
from statsmodels.stats.proportion import proportions_ztest
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
