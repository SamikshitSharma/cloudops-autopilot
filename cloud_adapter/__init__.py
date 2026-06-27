import logging
from cloud_adapter.interface import AzureClientAdapter
from cloud_adapter.mock_client import MockAzureClient
from shared.config import settings

logger = logging.getLogger("cloud_adapter")

_cached_client: AzureClientAdapter = None

def get_azure_client() -> AzureClientAdapter:
    """Factory function to retrieve the configured Azure client instance (Singleton)."""
    global _cached_client
    if _cached_client is not None:
        return _cached_client

    mode = settings.CLOUD_MODE.upper()
    logger.info(f"Initializing cloud client adapter in mode: {mode}")

    if mode == "LIVE":
        try:
            from cloud_adapter.live_client import LiveAzureClient
            _cached_client = LiveAzureClient()
        except Exception as e:
            logger.error(f"Failed to load LiveAzureClient, falling back to MockAzureClient: {e}")
            _cached_client = MockAzureClient()
    else:
        _cached_client = MockAzureClient()

    return _cached_client
