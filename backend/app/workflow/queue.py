from typing import List, Optional
from backend.app.workflow.models import ActionPlan

class ExecutionQueue:
    """Lightweight in-memory task queue managing ActionPlan execution orders.
    
    All public methods are defined as asynchronous to support seamless migration
    to persistent queues (e.g., SQLite, PostgreSQL, Redis, or RabbitMQ) in future
    milestones without modifying calling code interfaces.
    """
    
    def __init__(self) -> None:
        self._queue: List[ActionPlan] = []

    async def push(self, action: ActionPlan) -> None:
        """Appends a new ActionPlan to the tail of the queue."""
        self._queue.append(action)

    async def pop(self) -> Optional[ActionPlan]:
        """Removes and returns the front ActionPlan from the queue, or None if empty."""
        if not self._queue:
            return None
        return self._queue.pop(0)

    async def peek(self) -> Optional[ActionPlan]:
        """Returns the front ActionPlan without removing it, or None if empty."""
        if not self._queue:
            return None
        return self._queue[0]

    async def size(self) -> int:
        """Returns the current number of items waiting in the queue."""
        return len(self._queue)

    async def clear(self) -> None:
        """Clears all actions currently queued."""
        self._queue.clear()

    async def list_actions(self) -> List[ActionPlan]:
        """Returns a copy of all actions currently queued."""
        return list(self._queue)
