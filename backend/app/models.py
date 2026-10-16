from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("status IN ('Todo', 'In Progress', 'Done')", name="task_status"),
        CheckConstraint("priority IN ('Low', 'Medium', 'High')", name="task_priority"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="Todo", index=True)
    priority: Mapped[str] = mapped_column(String(10), default="Medium")
    assignee: Mapped[str] = mapped_column(String(100), default="Unassigned")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
