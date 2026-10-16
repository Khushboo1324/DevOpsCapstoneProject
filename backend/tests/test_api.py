import pytest
from sqlalchemy.exc import OperationalError
from app.main import app
from app.database import get_db

PAYLOAD = {"title": "Deploy TaskBoard", "priority": "High", "assignee": "Maya"}

def test_system(client):
    assert client.get("/").json()["name"] == "TaskBoard"
    assert client.get("/health").json() == {"status": "healthy"}
    assert client.get("/ready").status_code == 200
    assert "http_requests_total" in client.get("/metrics").text
    assert client.get("/docs").status_code == 200

def test_crud(client):
    response = client.post("/api/tasks", json=PAYLOAD)
    assert response.status_code == 201
    task = response.json()
    assert task["created_at"] and task["updated_at"]
    assert task["status"] == "Todo"
    url = f"/api/tasks/{task['id']}"
    assert client.get(url).json() == task
    assert client.get("/api/tasks").json() == [task]
    updated = client.put(url, json={**PAYLOAD, "status": "Done", "description": "Verified"})
    assert updated.status_code == 200
    assert updated.json()["description"] == "Verified"
    assert updated.json()["status"] == "Done"
    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404
    assert client.get("/api/tasks").json() == []

def test_stats_and_filters(client):
    assert client.get("/api/tasks/stats").json()["total"] == 0
    for status in ["Todo", "In Progress", "Done"]:
        client.post("/api/tasks", json={**PAYLOAD, "status": status})
    assert client.get("/api/tasks/stats").json() == {"total": 3, "todo": 1, "in_progress": 1, "done": 1, "high_priority": 3}
    assert len(client.get("/api/tasks?status=Done&priority=High").json()) == 1
    assert client.get("/api/tasks?priority=Low").json() == []
    assert client.get("/api/tasks?status=unknown").status_code == 422

@pytest.mark.parametrize("data", [{}, {"title": "  "}, {"title": "x", "status": "bad"}, {"title": "x", "priority": "urgent"}, {"title": "x"*201}, {"title": "x", "assignee": None}])
def test_validation(client, data):
    assert client.post("/api/tasks", json=data).status_code == 422

@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_missing(client, method):
    kwargs = {"json": PAYLOAD} if method == "put" else {}
    assert getattr(client, method)("/api/tasks/999", **kwargs).status_code == 404

def test_readiness_failure(client):
    class BrokenDB:
        def execute(self, query):
            raise OperationalError("SELECT 1", {}, Exception("offline"))
    app.dependency_overrides[get_db] = lambda: BrokenDB()
    assert client.get("/ready").status_code == 503
    assert client.get("/health").status_code == 200

def test_seed_once(client, monkeypatch):
    from app import seed
    from sqlalchemy.orm import sessionmaker
    with next(app.dependency_overrides[get_db]()) as session:
        monkeypatch.setattr(seed, "SessionLocal", sessionmaker(bind=session.get_bind()))
        seed.seed()
        seed.seed()
    assert client.get("/api/tasks/stats").json()["total"] == 6
