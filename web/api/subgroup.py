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

    if aggregation not in ('mean', 'count', 'sum'):
        return jsonify({'error': "aggregation must be 'mean', 'count', or 'sum'"}), 400

    try:
        df = pd.read_csv(io.BytesIO(request.files['csv'].read()))
    except Exception as e:
        return jsonify({'error': f'Failed to read CSV: {str(e)}'}), 400

    # Support derived date columns: dayofweek(col), week(col), month(col), year(col)
    DATE_DERIVATIONS = {
        'dayofweek': lambda s: pd.to_datetime(s).dt.day_name(),
        'week':      lambda s: pd.to_datetime(s).dt.isocalendar().week.astype(str),
        'month':     lambda s: pd.to_datetime(s).dt.strftime('%B'),
        'year':      lambda s: pd.to_datetime(s).dt.year.astype(str),
    }
    derived_label = None
    for fn_name, fn in DATE_DERIVATIONS.items():
        prefix = f'{fn_name}('
        if group_column.startswith(prefix) and group_column.endswith(')'):
            source_col = group_column[len(prefix):-1]
            if source_col not in df.columns:
                return jsonify({'error': f"Column '{source_col}' not found in CSV"}), 400
            try:
                df[group_column] = fn(df[source_col])
            except Exception:
                return jsonify({'error': f"Could not parse '{source_col}' as dates"}), 400
            derived_label = group_column
            break

    if derived_label is None and group_column not in df.columns:
        return jsonify({'error': f"Column '{group_column}' not found in CSV"}), 400

    missing = [c for c in metric_columns if c not in df.columns]
    if missing:
        return jsonify({'error': f"Columns not found in CSV: {', '.join(missing)}"}), 400

    if df[group_column].nunique() > 50:
        return jsonify({'error': f"Too many unique values in '{group_column}' (max 50)"}), 400

    grouped = df.groupby(group_column)[metric_columns].agg(aggregation).round(4)
    table = _df_to_markdown(grouped)

    return jsonify({'table': table})
