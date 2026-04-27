import sys
import os
import random
from io import BytesIO
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from api.interaction import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as c:
        yield c


def _binary_csv(n_per_cell=50, seed=42):
    random.seed(seed)
    days = ['Mon', 'Tue', 'Wed', 'Thu']
    rows = ['treatment,day,converted']
    for day in days:
        for treatment in [0, 1]:
            rate = 0.4 + treatment * 0.1  # constant lift across days
            for _ in range(n_per_cell):
                rows.append(f'{treatment},{day},{1 if random.random() < rate else 0}')
    return '\n'.join(rows)


def test_interaction_returns_summary(client):
    response = client.post(
        '/api/interaction',
        data={
            'csv': (BytesIO(_binary_csv().encode()), 'data.csv'),
            'metric_column': 'converted',
            'treatment_column': 'treatment',
            'breakdown_column': 'day',
            'metric_type': 'binary',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    assert 'summary' in data
    assert isinstance(data['interaction_pvalue'], float)
    assert 0 <= data['interaction_pvalue'] <= 1
    assert data['n_obs'] == 400
    assert len(data['buckets']) == 4
    assert data['model_type'] == 'logistic regression'
    assert 'Joint interaction p-value' in data['summary']


def test_interaction_with_dayofweek_derivation(client):
    random.seed(7)
    rows = ['treatment,assignment_date,converted']
    dates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04']
    for date in dates:
        for treatment in [0, 1]:
            rate = 0.3 + treatment * 0.08
            for _ in range(50):
                rows.append(f'{treatment},{date},{1 if random.random() < rate else 0}')
    csv = '\n'.join(rows)
    response = client.post(
        '/api/interaction',
        data={
            'csv': (BytesIO(csv.encode()), 'data.csv'),
            'metric_column': 'converted',
            'treatment_column': 'treatment',
            'breakdown_column': 'dayofweek(assignment_date)',
            'metric_type': 'binary',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    bucket_names = {b['bucket'] for b in data['buckets']}
    assert bucket_names <= {'Monday', 'Tuesday', 'Wednesday', 'Thursday'}
    assert len(bucket_names) == 4


def test_interaction_continuous(client):
    random.seed(11)
    rows = ['treatment,bucket,value']
    for bucket in ['A', 'B', 'C']:
        for treatment in [0, 1]:
            for _ in range(40):
                rows.append(f'{treatment},{bucket},{1.0 + treatment * 0.3 + random.random() * 0.5}')
    csv = '\n'.join(rows)
    response = client.post(
        '/api/interaction',
        data={
            'csv': (BytesIO(csv.encode()), 'data.csv'),
            'metric_column': 'value',
            'treatment_column': 'treatment',
            'breakdown_column': 'bucket',
            'metric_type': 'continuous',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data['model_type'] == 'OLS regression'


def test_interaction_missing_required(client):
    response = client.post(
        '/api/interaction',
        data={'csv': (BytesIO(b'a,b\n1,2'), 'data.csv')},
        content_type='multipart/form-data',
    )
    assert response.status_code == 400


def test_interaction_invalid_metric_type(client):
    csv = 'treatment,day,converted\n0,Mon,1\n1,Mon,0'
    response = client.post(
        '/api/interaction',
        data={
            'csv': (BytesIO(csv.encode()), 'data.csv'),
            'metric_column': 'converted',
            'treatment_column': 'treatment',
            'breakdown_column': 'day',
            'metric_type': 'gibberish',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'metric_type' in response.get_json()['error']


def test_interaction_too_few_rows(client):
    csv = 'treatment,day,converted\n0,Mon,1\n1,Mon,0\n0,Tue,1\n1,Tue,0'
    response = client.post(
        '/api/interaction',
        data={
            'csv': (BytesIO(csv.encode()), 'data.csv'),
            'metric_column': 'converted',
            'treatment_column': 'treatment',
            'breakdown_column': 'day',
            'metric_type': 'binary',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'Not enough' in response.get_json()['error']


def test_interaction_binary_with_date_string_metric(client):
    """Mostly-empty date-string column should be treated as 'presence = 1' regardless of pandas dtype.
    Regression for the production bug where pandas inferred this column as 'string'/'datetime' rather
    than 'object', causing the not_null fallback path to be skipped and rates to come back as 0%."""
    rows = ['treatment,assignment_date,paid_signup_date']
    dates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04']
    random.seed(13)
    for date in dates:
        for treatment in [0, 1]:
            rate = 0.3 + treatment * 0.05
            for _ in range(40):
                signup = '2024-02-15' if random.random() < rate else ''
                rows.append(f'{treatment},{date},{signup}')
    csv = '\n'.join(rows)
    response = client.post(
        '/api/interaction',
        data={
            'csv': (BytesIO(csv.encode()), 'data.csv'),
            'metric_column': 'paid_signup_date',
            'treatment_column': 'treatment',
            'breakdown_column': 'dayofweek(assignment_date)',
            'metric_type': 'binary',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    # Per-bucket rates must NOT all be zero — that was the production symptom
    nonzero_rates = [b for b in data['buckets'] if b['control_rate'] > 0 or b['treatment_rate'] > 0]
    assert len(nonzero_rates) > 0, f"All rates returned as zero: {data['buckets']}"


def test_interaction_column_not_in_csv(client):
    csv = 'treatment,day,converted\n0,Mon,1\n1,Mon,0'
    response = client.post(
        '/api/interaction',
        data={
            'csv': (BytesIO(csv.encode()), 'data.csv'),
            'metric_column': 'nonexistent',
            'treatment_column': 'treatment',
            'breakdown_column': 'day',
            'metric_type': 'binary',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'not found' in response.get_json()['error']
