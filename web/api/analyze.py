import json
import math
from flask import Flask, request, jsonify

app = Flask(__name__)


def _sanitize(obj):
    """Replace inf/nan with None for valid JSON."""
    if isinstance(obj, float):
        if math.isinf(obj) or math.isnan(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj


@app.route('/api/analyze', methods=['POST'])
def analyze():
    if 'csv' not in request.files:
        return jsonify({'error': 'Missing csv file'}), 400
    if 'config' not in request.form:
        return jsonify({'error': 'Missing config'}), 400

    csv_file = request.files['csv']

    try:
        config_data = json.loads(request.form['config'])
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid config JSON'}), 400

    try:
        from xp_analyzer.config import load_config_dict
        from xp_analyzer.loader import load_experiment_data
        from xp_analyzer.analyzer import run_analysis
        from xp_analyzer.findings import generate_findings, generate_recommendation
        from xp_analyzer.models import ExperimentResult

        config = load_config_dict(config_data)
        groups = load_experiment_data(csv_file.stream, config)
        metric_results = run_analysis(config, groups)
        findings = generate_findings(metric_results)
        recommendation = generate_recommendation(findings, metric_results=metric_results)

        treatment_groups = [g for g in groups if g != config.control_group]
        # Total users: sum the row count for the first metric across all groups
        first_metric = config.metrics[0].name
        total_users = sum(len(gd[first_metric]) for gd in groups.values())

        result = ExperimentResult(
            experiment_name=config.experiment_name,
            control_group=config.control_group,
            treatment_groups=treatment_groups,
            total_users=total_users,
            metric_results=metric_results,
            findings=findings,
            recommendation=recommendation,
        )

        return jsonify(_sanitize(result.to_dict()))

    except (ValueError, KeyError) as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Analysis failed: {e}'}), 500
