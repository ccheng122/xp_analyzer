import pytest
import json
import sys
import os
from io import BytesIO

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from api.subgroup import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as c:
        yield c


CSV = (
    "group,value,other\n"
    "a,1.0,10\n"
    "a,2.0,20\n"
    "b,3.0,30\n"
    "b,4.0,40\n"
)


def test_subgroup_mean_returns_table(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'group',
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    assert 'table' in data
    assert 'a' in data['table']
    assert '1.5' in data['table']
    assert 'b' in data['table']
    assert '3.5' in data['table']


def test_subgroup_count(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'group',
            'metric_columns': json.dumps(['value']),
            'aggregation': 'count',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    assert '2' in data['table']


def test_subgroup_missing_csv(client):
    response = client.post(
        '/api/subgroup',
        data={
            'group_column': 'group',
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'error' in response.get_json()


def test_subgroup_missing_group_column(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'error' in response.get_json()


def test_subgroup_column_not_in_csv(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'nonexistent',
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'not found' in response.get_json()['error']


def test_subgroup_metric_column_not_in_csv(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'group',
            'metric_columns': json.dumps(['nonexistent']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'not found' in response.get_json()['error']
