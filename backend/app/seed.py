"""Explicit demo seed; PostgreSQL transaction lock makes repeated/concurrent runs safe."""
from sqlalchemy import select, text
from .database import SessionLocal
from .models import Task

DEMO = [
    ("Design the workspace dashboard", "Create a focused home for the team's work.", "Done", "High", "Maya Patel"),
    ("Build the task management API", "Ship validated CRUD endpoints and dashboard statistics.", "Done", "High", "Alex Morgan"),
    ("Set up the CI quality gates", "Run tests and scan both container images before publication.", "In Progress", "High", "Jordan Lee"),
    ("Provision the EKS environment", "Review Terraform plan for VPC and managed nodes.", "Todo", "Medium", "Sam Chen"),
    ("Create the Grafana dashboard", "Visualize traffic, latency, and backend replicas.", "In Progress", "Medium", "Maya Patel"),
    ("Write the deployment runbook", "Walk through Helm install, rollback, and cleanup.", "Todo", "Low", "Alex Morgan"),
]

def seed():
    with SessionLocal.begin() as db:
        if db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(842101)"))
        # Seed once per database, even after users rename or delete demo tasks.
        db.execute(text("CREATE TABLE IF NOT EXISTS demo_seed (id INTEGER PRIMARY KEY)"))
        if db.execute(text("SELECT id FROM demo_seed WHERE id = 1")).first():
            return
        for title, description, status, priority, assignee in DEMO:
            db.add(Task(title=title, description=description, status=status, priority=priority, assignee=assignee))
        db.execute(text("INSERT INTO demo_seed (id) VALUES (1)"))

if __name__ == "__main__":
    seed()
