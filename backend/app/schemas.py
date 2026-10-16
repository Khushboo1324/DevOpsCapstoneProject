from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

Status = Literal["Todo", "In Progress", "Done"]
Priority = Literal["Low", "Medium", "High"]

class TaskInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    status: Status = "Todo"
    priority: Priority = "Medium"
    assignee: str = Field(default="Unassigned", min_length=1, max_length=100)

class TaskOutput(TaskInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime

class TaskStats(BaseModel):
    total: int
    todo: int
    in_progress: int
    done: int
    high_priority: int
