"""Create tasks with portable constraints and timezone-aware timestamps."""
from alembic import op
import sqlalchemy as sa
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("priority", sa.String(10), nullable=False),
        sa.Column("assignee", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('Todo', 'In Progress', 'Done')", name="task_status"),
        sa.CheckConstraint("priority IN ('Low', 'Medium', 'High')", name="task_priority"),
    )
    op.create_index("ix_tasks_status", "tasks", ["status"])

def downgrade():
    op.drop_index("ix_tasks_status", table_name="tasks")
    op.drop_table("tasks")
