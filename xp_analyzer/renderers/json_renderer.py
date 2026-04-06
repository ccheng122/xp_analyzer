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
