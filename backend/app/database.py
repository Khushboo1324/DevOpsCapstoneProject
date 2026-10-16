import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://taskboard:taskboard@localhost:5432/taskboard")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 3} if DATABASE_URL.startswith("postgresql") else {})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    with SessionLocal() as session:
        yield session
