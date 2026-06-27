import logging
import asyncio
from typing import Dict, List, Callable, Any, Awaitable
from datetime import datetime

logger = logging.getLogger("EventBus")

class EventBus:
    """Lightweight in-process publish/subscribe event bus.
    
    Coordinates decoupling between agents, workflow engines, and backend loggers.
    """
    
    def __init__(self) -> None:
        self._subscribers: Dict[str, List[Callable[[Dict[str, Any]], Awaitable[None]]]] = {}

    def subscribe(self, event_name: str, callback: Callable[[Dict[str, Any]], Awaitable[None]]) -> None:
        """Register an async callback handler for a specific event name."""
        if event_name not in self._subscribers:
            self._subscribers[event_name] = []
        if callback not in self._subscribers[event_name]:
            self._subscribers[event_name].append(callback)
            logger.debug(f"Subscriber registered for event: {event_name}")

    def unsubscribe(self, event_name: str, callback: Callable[[Dict[str, Any]], Awaitable[None]]) -> None:
        """Remove a registered callback handler from an event name's list."""
        if event_name in self._subscribers:
            try:
                self._subscribers[event_name].remove(callback)
                logger.debug(f"Subscriber removed from event: {event_name}")
            except ValueError:
                pass

    async def publish(self, event_name: str, payload: Dict[str, Any]) -> None:
        """Asynchronously dispatch an event payload to all registered subscribers.
        
        Ensures that failures inside one handler do not block other handlers or the main loop.
        """
        if "timestamp" not in payload:
            payload["timestamp"] = datetime.utcnow().isoformat() + "Z"
            
        subscribers = self._subscribers.get(event_name, [])
        if not subscribers:
            logger.debug(f"No subscribers registered for event '{event_name}' - skipping dispatch.")
            return

        logger.info(f"Publishing event '{event_name}' with {len(subscribers)} subscribers.")
        
        # Dispatch callbacks concurrently
        tasks = []
        for callback in subscribers:
            tasks.append(self._execute_callback(callback, event_name, payload))
            
        await asyncio.gather(*tasks)

    async def _execute_callback(self, callback: Callable[[Dict[str, Any]], Awaitable[None]], event_name: str, payload: Dict[str, Any]) -> None:
        try:
            await callback(payload)
        except Exception as e:
            logger.error(f"Error executing callback for event '{event_name}' in handler '{callback.__name__}': {e}", exc_info=True)

# Global event bus instance
event_bus = EventBus()
