from typing import Annotated
from fastapi import Depends, FastAPI, Response
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from . import crud
from .database import get_db
from .schemas import TaskInput, TaskOutput, TaskStats, Status, Priority

app = FastAPI(title="TaskBoard API", version="1.0.0")
DB = Annotated[Session, Depends(get_db)]
Instrumentator(excluded_handlers=["/metrics", "/health", "/ready"]).instrument(app).expose(app)

@app.get("/")
def root():
    return {"name": "TaskBoard", "version": "1.0.0", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/ready")
def ready(db: DB):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "unavailable"})

@app.get("/api/tasks", response_model=list[TaskOutput])
def tasks(db: DB, status: Status | None = None, priority: Priority | None = None):
    return crud.list_tasks(db, status, priority)

# Static route must precede the dynamic ID route.
@app.get("/api/tasks/stats", response_model=TaskStats)
def task_stats(db: DB):
    return crud.stats(db)

@app.get("/api/tasks/{task_id}", response_model=TaskOutput)
def task(task_id: int, db: DB):
    return crud.get_task(db, task_id)

@app.post("/api/tasks", response_model=TaskOutput, status_code=201)
def create_task(data: TaskInput, db: DB):
    return crud.save_task(db, data)

@app.put("/api/tasks/{task_id}", response_model=TaskOutput)
def update_task(task_id: int, data: TaskInput, db: DB):
    return crud.save_task(db, data, crud.get_task(db, task_id))

@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: DB):
    db.delete(crud.get_task(db, task_id))
    db.commit()
    return Response(status_code=204)
