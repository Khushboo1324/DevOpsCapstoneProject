from alembic import context
from app.database import Base, engine
from app import models  # noqa: F401

if context.is_offline_mode():
    context.configure(url=str(engine.url), target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    with engine.connect() as connection:
        # All replicas can run the entrypoint; serialize migrations before Alembic
        # reads its version table. Session lock is released even after an error.
        postgres = connection.dialect.name == "postgresql"
        try:
            if postgres:
                connection.exec_driver_sql("SELECT pg_advisory_lock(842100)")
                connection.commit()
            context.configure(connection=connection, target_metadata=Base.metadata)
            with context.begin_transaction():
                context.run_migrations()
        finally:
            if postgres:
                connection.rollback()
                connection.exec_driver_sql("SELECT pg_advisory_unlock(842100)")
                connection.commit()
