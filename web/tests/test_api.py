import pytest
import json
import sys
import os
from io import BytesIO

# Make xp_analyzer importable from parent
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from api.analyze import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as c:
        yield c


def test_analyze_returns_result(client):
    """POST with valid CSV + config returns ExperimentResult JSON."""
    csv_content = (
        "variant,converted,plan_canceled\n"
        + "0,1,0\n" * 100
        + "0,0,0\n" * 100
        + "1,1,0\n" * 60
        + "1,0,1\n" * 40
    )
    config = {
        "experiment_name": "Test",
        "group_column": "variant",
        "control_group": "0",
        "metrics": [
            {
                "name": "conversion",
                "column": "converted",
                "type": "binary",
                "role": "primary",
                "higher_is_better": True,
            }
        ],
    }
    response = client.post(
        '/api/analyze',
        data={
            'csv': (BytesIO(csv_content.encode()), 'data.csv'),
            'config': json.dumps(config),
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data['experiment_name'] == 'Test'
    assert 'metric_results' in data
    assert 'recommendation' in data
    assert data['recommendation']['decision'] in (
        'ship', "don't ship", 'needs more data', 'inconclusive', 'review guardrail'
    )


def test_analyze_missing_csv(client):
    response = client.post(
        '/api/analyze',
        data={'config': '{}'},
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'error' in response.get_json()


def test_analyze_bad_config(client):
    csv_content = "variant,converted\n0,1\n1,0\n"
    config = {"experiment_name": "x"}  # missing required fields
    response = client.post(
        '/api/analyze',
        data={
            'csv': (BytesIO(csv_content.encode()), 'data.csv'),
            'config': json.dumps(config),
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'error' in response.get_json()


def test_analyze_invalid_config_json(client):
    csv_content = "variant,converted\n0,1\n1,0\n"
    response = client.post(
        '/api/analyze',
        data={
            'csv': (BytesIO(csv_content.encode()), 'data.csv'),
            'config': 'not-valid-json{{{',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'error' in response.get_json()
