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


def test_subgroup_too_many_groups(client):
    csv_with_51_groups = "group,value\n" + "\n".join([f"{i},1.0" for i in range(51)])
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(csv_with_51_groups.encode()), 'data.csv'),
            'group_column': 'group',
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'Too many' in response.get_json()['error']


def test_subgroup_invalid_aggregation(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'group',
            'metric_columns': json.dumps(['value']),
            'aggregation': 'invalid',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'aggregation must be' in response.get_json()['error']


def test_subgroup_missing_metric_columns(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'group',
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'error' in response.get_json()


def test_subgroup_multiple_metrics(client):
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': 'group',
            'metric_columns': json.dumps(['value', 'other']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    assert 'value' in data['table']
    assert 'other' in data['table']


MULTI_CSV = (
    "treatment,assignment_date,converted\n"
    "0,2024-01-01,1\n"  # Mon, control, converted
    "0,2024-01-01,0\n"  # Mon, control, not
    "0,2024-01-02,1\n"  # Tue, control, converted
    "1,2024-01-01,1\n"  # Mon, treatment, converted
    "1,2024-01-02,1\n"  # Tue, treatment, converted
    "1,2024-01-02,0\n"  # Tue, treatment, not
)


def test_subgroup_multi_column_groupby(client):
    """Passing a JSON list as group_column produces a cross-tab table."""
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(MULTI_CSV.encode()), 'data.csv'),
            'group_column': json.dumps(['treatment', 'dayofweek(assignment_date)']),
            'metric_columns': json.dumps(['converted']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    table = data['table']
    # Header should include both index columns
    assert 'treatment' in table
    assert 'dayofweek(assignment_date)' in table
    # Should have a row for each treatment × day combination present
    assert 'Monday' in table
    assert 'Tuesday' in table


def test_subgroup_multi_column_too_many_combinations(client):
    """50-bucket cap applies to combinations, not just one column."""
    rows = []
    for i in range(8):
        for j in range(8):  # 8 × 8 = 64 combinations > 50
            rows.append(f"{i},{j},1.0")
    csv = "a,b,value\n" + "\n".join(rows)
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(csv.encode()), 'data.csv'),
            'group_column': json.dumps(['a', 'b']),
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 400
    assert 'Too many' in response.get_json()['error']


def test_subgroup_single_column_via_json_array(client):
    """An array with one column name behaves like the legacy string form."""
    response = client.post(
        '/api/subgroup',
        data={
            'csv': (BytesIO(CSV.encode()), 'data.csv'),
            'group_column': json.dumps(['group']),
            'metric_columns': json.dumps(['value']),
            'aggregation': 'mean',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 200
    data = response.get_json()
    assert 'a' in data['table']
    assert '1.5' in data['table']
