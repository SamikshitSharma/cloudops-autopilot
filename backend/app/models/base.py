import uuid
from backend.app.database import Base

def generate_uuid() -> str:
    """Helper utility generating UUID strings for primary keys."""
    return str(uuid.uuid4())
