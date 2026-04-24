import json
import io
import pandas as pd
from flask import Flask, request, jsonify

app = Flask(__name__)


def _df_to_markdown(df: pd.DataFrame) -> str:
    """Format a DataFrame as a markdown table."""
    index_name = df.index.name or 'group'
    cols = [index_name] + list(df.columns)
    header = '| ' + ' | '.join(str(c) for c in cols) + ' |'
    sep = '| ' + ' | '.join(['---'] * len(cols)) + ' |'
    rows = [
        '| ' + ' | '.join([str(idx)] + [str(v) for v in row]) + ' |'
        for idx, row in df.iterrows()
    ]
    return '\n'.join([header, sep] + rows)


@app.route('/api/subgroup', methods=['POST'])
def subgroup():
    if 'csv' not in request.files:
        return jsonify({'error': 'Missing csv file'}), 400

    group_column = request.form.get('group_column')
    metric_columns_raw = request.form.get('metric_columns')
    aggregation = request.form.get('aggregation', 'mean')

    if not group_column:
        return jsonify({'error': 'Missing group_column'}), 400
    if not metric_columns_raw:
        return jsonify({'error': 'Missing metric_columns'}), 400

    try:
        metric_columns = json.loads(metric_columns_raw)
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid metric_columns JSON'}), 400

    if not isinstance(metric_columns, list):
        return jsonify({'error': 'metric_columns must be a JSON array'}), 400

    if aggregation not in ('mean', 'count', 'sum', 'not_null_rate'):
        return jsonify({'error': "aggregation must be 'mean', 'count', 'sum', or 'not_null_rate'"}), 400

    try:
        df = pd.read_csv(io.BytesIO(request.files['csv'].read()))
    except Exception as e:
        return jsonify({'error': f'Failed to read CSV: {str(e)}'}), 400

    # Support derived date columns: dayofweek(col), week(col), month(col), year(col)
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
    derived_label = None
    for fn_name, fn in DATE_DERIVATIONS.items():
        prefix = f'{fn_name}('
        if group_column.startswith(prefix) and group_column.endswith(')'):
            source_col = group_column[len(prefix):-1]
            if source_col not in df.columns:
                return jsonify({'error': f"Column '{source_col}' not found in CSV"}), 400
            try:
                derived = fn(df[source_col])
                if derived.isna().all():
                    return jsonify({'error': f"Could not parse any values in '{source_col}' as dates. Sample values: {df[source_col].dropna().head(3).tolist()}"}), 400
                df[group_column] = derived
            except Exception as e:
                return jsonify({'error': f"Could not parse '{source_col}' as dates: {str(e)}. Sample values: {df[source_col].dropna().head(3).tolist()}"}), 400
            derived_label = group_column
            break

    if derived_label is None and group_column not in df.columns:
        return jsonify({'error': f"Column '{group_column}' not found in CSV"}), 400

    missing = [c for c in metric_columns if c not in df.columns]
    if missing:
        return jsonify({'error': f"Columns not found in CSV: {', '.join(missing)}"}), 400

    if df[group_column].nunique() > 50:
        return jsonify({'error': f"Too many unique values in '{group_column}' (max 50)"}), 400

    if aggregation == 'not_null_rate':
        grouped = df.groupby(group_column)[metric_columns].apply(lambda x: x.notna().mean()).round(4)
    else:
        grouped = df.groupby(group_column)[metric_columns].agg(aggregation).round(4)
    table = _df_to_markdown(grouped)

    return jsonify({'table': table})
