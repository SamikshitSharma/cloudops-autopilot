from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from shared.config import settings

# Determine engine parameters based on database type (SQLite needs special args)
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

connect_args = {}
if is_sqlite:
    # SQLite-specific parameter to allow database sharing across multi-threaded FastAPI calls
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def run_migrations(engine):
    from sqlalchemy import text
    import backend.app.models
    Base.metadata.create_all(bind=engine)
    try:
        with engine.begin() as conn:
            res = conn.execute(text("PRAGMA table_info(recommendations)")).fetchall()
            column_names = [col[1] for col in res]
            if "confidence_score" not in column_names:
                conn.execute(text("ALTER TABLE recommendations ADD COLUMN confidence_score FLOAT"))
            if "evidence" not in column_names:
                conn.execute(text("ALTER TABLE recommendations ADD COLUMN evidence VARCHAR(1000)"))
            if "reasoning_chain" not in column_names:
                conn.execute(text("ALTER TABLE recommendations ADD COLUMN reasoning_chain JSON"))
    except Exception as migration_err:
        import logging
        logging.getLogger("Database").error(f"Failed to auto-migrate database columns: {migration_err}")

# Auto-migrate on database module load
run_migrations(engine)

def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency to yield database sessions with automated closure."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

