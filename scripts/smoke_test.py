#!/usr/bin/env python3
"""Check an already-running demo; create and remove one uniquely named test task."""
import argparse
import json
import urllib.request
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frontend', default='http://127.0.0.1:3000')
    parser.add_argument('--backend', default='http://127.0.0.1:8000')
    args = parser.parse_args()
    base = args.frontend.rstrip('/')

    def request(path, method='GET', data=None):
        payload = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(base + path, data=payload, method=method,
                                     headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read()
            return response.status, json.loads(body) if body else None

    with urllib.request.urlopen(base, timeout=10) as response:
        assert response.status == 200
    baseline = request('/api/tasks/stats')[1]['total']
    payload = {'title': f'Smoke test {uuid.uuid4().hex[:8]}', 'priority': 'High', 'assignee': 'Smoke Test'}
    code, task = request('/api/tasks', 'POST', payload)
    assert code == 201
    url = f"/api/tasks/{task['id']}"
    try:
        assert request(url)[1]['title'] == payload['title']
        assert request(url, 'PUT', {**payload, 'status': 'Done'})[1]['status'] == 'Done'
    finally:
        assert request(url, 'DELETE')[0] == 204
    assert request('/api/tasks/stats')[1]['total'] == baseline
    for path in ['/health', '/ready', '/docs', '/metrics']:
        with urllib.request.urlopen(args.backend.rstrip('/') + path, timeout=10) as response:
            assert response.status == 200
    print('PASS: frontend, PostgreSQL CRUD/stats through proxy, health, readiness, Swagger, metrics')


if __name__ == '__main__':
    main()
