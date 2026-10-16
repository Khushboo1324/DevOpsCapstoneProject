from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from .models import Task
from .schemas import TaskInput

def get_task(db: Session, task_id: int):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    return task

def list_tasks(db: Session, status=None, priority=None):
    query = select(Task).order_by(Task.created_at.desc(), Task.id.desc())
    if status:
        query = query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)
    return db.scalars(query).all()

def save_task(db: Session, data: TaskInput, task=None):
    task = task or Task()
    for key, value in data.model_dump().items():
        setattr(task, key, value)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

def stats(db: Session):
    grouped = dict(db.execute(select(Task.status, func.count()).group_by(Task.status)).all())
    return dict(total=sum(grouped.values()), todo=grouped.get("Todo", 0),
                in_progress=grouped.get("In Progress", 0), done=grouped.get("Done", 0),
                high_priority=db.scalar(select(func.count()).select_from(Task).where(Task.priority == "High")))
