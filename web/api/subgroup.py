import json
import io
import pandas as pd
from flask import Flask, request, jsonify

app = Flask(__name__)


def _df_to_markdown(df: pd.DataFrame) -> str:
    """Format a DataFrame as a markdown table. Handles single- and multi-index."""
    index_names = [n if n is not None else 'group' for n in df.index.names]
    cols = list(index_names) + list(df.columns)
    header = '| ' + ' | '.join(str(c) for c in cols) + ' |'
    sep = '| ' + ' | '.join(['---'] * len(cols)) + ' |'
    rows = []
    for idx, row in df.iterrows():
        idx_values = list(idx) if isinstance(idx, tuple) else [idx]
        rows.append('| ' + ' | '.join([str(v) for v in idx_values] + [str(v) for v in row]) + ' |')
    return '\n'.join([header, sep] + rows)


@app.route('/api/subgroup', methods=['POST'])
def subgroup():
    if 'csv' not in request.files:
        return jsonify({'error': 'Missing csv file'}), 400

    group_column_raw = request.form.get('group_column')
    metric_columns_raw = request.form.get('metric_columns')
    aggregation = request.form.get('aggregation', 'mean')

    if not group_column_raw:
        return jsonify({'error': 'Missing group_column'}), 400
    if not metric_columns_raw:
        return jsonify({'error': 'Missing metric_columns'}), 400

    # group_column accepts either a single column name or a JSON-encoded list of
    # column names for multi-dimensional groupby (e.g. ["treatment", "dayofweek(date)"]).
    try:
        parsed_group = json.loads(group_column_raw)
        if (
            isinstance(parsed_group, list)
            and len(parsed_group) > 0
            and all(isinstance(c, str) for c in parsed_group)
        ):
            group_columns = parsed_group
        else:
            group_columns = [group_column_raw]
    except json.JSONDecodeError:
        group_columns = [group_column_raw]

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
    for gc in group_columns:
        derived = False
        for fn_name, fn in DATE_DERIVATIONS.items():
            prefix = f'{fn_name}('
            if gc.startswith(prefix) and gc.endswith(')'):
                source_col = gc[len(prefix):-1]
                if source_col not in df.columns:
                    return jsonify({'error': f"Column '{source_col}' not found in CSV"}), 400
                try:
                    derived_values = fn(df[source_col])
                    if derived_values.isna().all():
                        return jsonify({'error': f"Could not parse any values in '{source_col}' as dates. Sample values: {df[source_col].dropna().head(3).tolist()}"}), 400
                    df[gc] = derived_values
                except Exception as e:
                    return jsonify({'error': f"Could not parse '{source_col}' as dates: {str(e)}. Sample values: {df[source_col].dropna().head(3).tolist()}"}), 400
                derived = True
                break
        if not derived and gc not in df.columns:
            return jsonify({'error': f"Column '{gc}' not found in CSV"}), 400

    missing = [c for c in metric_columns if c not in df.columns]
    if missing:
        return jsonify({'error': f"Columns not found in CSV: {', '.join(missing)}"}), 400

    if df[group_columns].drop_duplicates().shape[0] > 50:
        cols_label = ' × '.join(group_columns)
        return jsonify({'error': f"Too many unique combinations of '{cols_label}' (max 50)"}), 400

    # Pass a string for single-column groupby (preserves regular Index in result),
    # a list for multi-column (returns MultiIndex).
    group_arg = group_columns[0] if len(group_columns) == 1 else group_columns
    if aggregation == 'not_null_rate':
        grouped = df.groupby(group_arg)[metric_columns].apply(lambda x: x.notna().mean()).round(4)
    else:
        grouped = df.groupby(group_arg)[metric_columns].agg(aggregation).round(4)
    table = _df_to_markdown(grouped)

    return jsonify({'table': table})
