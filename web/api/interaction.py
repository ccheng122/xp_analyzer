import io
import pandas as pd
import statsmodels.formula.api as smf
from flask import Flask, request, jsonify

app = Flask(__name__)


def _parse_dates(s):
    try:
        return pd.to_datetime(s, errors='coerce')
    except Exception:
        return pd.to_datetime(s, format='mixed', errors='coerce')


DATE_DERIVATIONS = {
    'dayofweek': lambda s: _parse_dates(s).dt.day_name(),
    'week':      lambda s: _parse_dates(s).dt.isocalendar().week.astype(str),
    'month':     lambda s: _parse_dates(s).dt.strftime('%B'),
    'year':      lambda s: _parse_dates(s).dt.year.astype(str),
}


def _materialize(df: pd.DataFrame, col: str) -> str:
    """If col is a date derivation expression, materialize it on df. Returns the column name in df."""
    for fn_name, fn in DATE_DERIVATIONS.items():
        prefix = f'{fn_name}('
        if col.startswith(prefix) and col.endswith(')'):
            source = col[len(prefix):-1]
            if source not in df.columns:
                raise KeyError(f"Column '{source}' not found in CSV")
            derived = fn(df[source])
            if derived.isna().all():
                raise ValueError(f"Could not parse any values in '{source}' as dates")
            df[col] = derived
            return col
    if col not in df.columns:
        raise KeyError(f"Column '{col}' not found in CSV")
    return col


@app.route('/api/interaction', methods=['POST'])
def interaction():
    if 'csv' not in request.files:
        return jsonify({'error': 'Missing csv file'}), 400

    metric_column = request.form.get('metric_column')
    treatment_column = request.form.get('treatment_column')
    breakdown_column = request.form.get('breakdown_column')
    metric_type = request.form.get('metric_type', 'binary')
    control_value = request.form.get('control_value', '0')

    if not metric_column or not treatment_column or not breakdown_column:
        return jsonify({'error': 'Missing metric_column, treatment_column, or breakdown_column'}), 400
    if metric_type not in ('binary', 'continuous'):
        return jsonify({'error': "metric_type must be 'binary' or 'continuous'"}), 400

    try:
        df = pd.read_csv(io.BytesIO(request.files['csv'].read()))
    except Exception as e:
        return jsonify({'error': f'Failed to read CSV: {str(e)}'}), 400

    try:
        breakdown_col = _materialize(df, breakdown_column)
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400

    if treatment_column not in df.columns:
        return jsonify({'error': f"Column '{treatment_column}' not found in CSV"}), 400
    if metric_column not in df.columns:
        return jsonify({'error': f"Column '{metric_column}' not found in CSV"}), 400

    # Build a clean (n × 3) frame for fitting.
    work = pd.DataFrame()
    work['_treatment'] = (df[treatment_column].astype(str) != str(control_value)).astype(int)
    if metric_type == 'binary':
        # Numeric columns: treat 0/NaN as 0, anything else as itself — caller's responsibility
        # to ensure values are 0/1. Non-numeric (object, string, string[pyarrow], datetime,
        # category): treat presence as 1 — matches subgroup.py's not_null_rate convention.
        # The dtype check pre-2026-04 was 'object'-only, which broke when production pandas
        # parsed mostly-empty date columns as 'string' or 'datetime64'.
        series = df[metric_column]
        if pd.api.types.is_numeric_dtype(series):
            work['_metric'] = pd.to_numeric(series, errors='coerce').fillna(0).astype(int)
        else:
            work['_metric'] = series.notna().astype(int)
    else:
        work['_metric'] = pd.to_numeric(df[metric_column], errors='coerce')
    work['_breakdown'] = df[breakdown_col].astype(str)
    work = work.dropna()

    if len(work) < 10:
        return jsonify({'error': 'Not enough non-null rows to fit a model (need at least 10)'}), 400
    if work['_breakdown'].nunique() < 2:
        return jsonify({'error': 'Breakdown column has fewer than 2 distinct values; nothing to test'}), 400
    if work['_treatment'].nunique() < 2:
        return jsonify({'error': 'Treatment column has fewer than 2 distinct values; nothing to test'}), 400

    formula = '_metric ~ _treatment * C(_breakdown)'
    try:
        if metric_type == 'binary':
            model = smf.logit(formula, data=work).fit(disp=0)
            model_label = 'logistic regression'
        else:
            model = smf.ols(formula, data=work).fit()
            model_label = 'OLS regression'
    except Exception as e:
        return jsonify({'error': f'Model fit failed: {str(e)}'}), 400

    interaction_terms = [t for t in model.params.index if ':' in t and '_treatment' in t]
    if not interaction_terms:
        return jsonify({'error': 'No interaction terms found in fitted model'}), 400

    try:
        wald = model.wald_test(interaction_terms, scalar=True)
        p_interaction = float(wald.pvalue)
    except Exception as e:
        return jsonify({'error': f'Joint Wald test failed: {str(e)}'}), 400

    bucket_rows = []
    for bucket in sorted(work['_breakdown'].unique()):
        sub = work[work['_breakdown'] == bucket]
        ctrl = sub[sub['_treatment'] == 0]['_metric']
        trt = sub[sub['_treatment'] == 1]['_metric']
        if len(ctrl) == 0 or len(trt) == 0:
            continue
        bucket_rows.append({
            'bucket': bucket,
            'control_rate': float(ctrl.mean()),
            'treatment_rate': float(trt.mean()),
            'lift': float(trt.mean() - ctrl.mean()),
            'n_control': int(len(ctrl)),
            'n_treatment': int(len(trt)),
        })

    fmt_rate = (lambda x: f'{x:.2%}') if metric_type == 'binary' else (lambda x: f'{x:.4f}')
    fmt_lift = (lambda x: f'{x:+.2%}') if metric_type == 'binary' else (lambda x: f'{x:+.4f}')
    lines = [
        f'**Interaction test**: treatment × {breakdown_column}',
        '',
        f'- Joint interaction p-value: {p_interaction:.4f}',
        f'- Model: {model_label}',
        f'- n observations: {len(work):,}',
        '',
        '| bucket | control_rate | treatment_rate | lift | n_control | n_treatment |',
        '| --- | --- | --- | --- | --- | --- |',
    ]
    for r in bucket_rows:
        lines.append(
            f'| {r["bucket"]} | {fmt_rate(r["control_rate"])} | {fmt_rate(r["treatment_rate"])} | '
            f'{fmt_lift(r["lift"])} | {r["n_control"]:,} | {r["n_treatment"]:,} |'
        )

    return jsonify({
        'summary': '\n'.join(lines),
        'interaction_pvalue': p_interaction,
        'n_obs': len(work),
        'model_type': model_label,
        'buckets': bucket_rows,
    })
