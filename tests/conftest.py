import os
# Inject required environment configuration for tests
os.environ["JWT_SECRET_KEY"] = "test_secret_key_for_unit_testing"
os.environ["CLOUD_MODE"] = "MOCK"
os.environ["DATABASE_URL"] = "sqlite:///./test_autopilot.db"

import pytest

@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db():
    if os.path.exists("./test_autopilot.db"):
        try:
            os.remove("./test_autopilot.db")
        except Exception:
            pass
    yield
    if os.path.exists("./test_autopilot.db"):
        try:
            os.remove("./test_autopilot.db")
        except Exception:
            pass


from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base
from cloud_adapter.mock_client import MockAzureClient

# In-memory SQLite engine for rapid unit tests
@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(test_engine):
    connection = test_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="module")
def mock_client():
    return MockAzureClient()
