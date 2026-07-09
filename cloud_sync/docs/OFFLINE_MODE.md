# LifeOS Offline Mode

The LifeOS Cloud Sync system is designed with an **offline-first** approach, ensuring that users can continue to interact with their data and perform critical tasks even without an active internet connection. This capability is fundamental to providing a seamless and reliable user experience in various environments.

## Principles of Offline Operation

1.  **Uninterrupted Productivity**: Users can create, modify, and delete data (e.g., Life Graph entries, Mission updates, Companion interactions) without requiring immediate cloud connectivity.
2.  **Data Integrity**: All changes made offline are stored locally in a robust `OfflineQueue` and are guaranteed to be synchronized with the cloud once connectivity is restored.
3.  **Seamless Transition**: The system automatically detects changes in network status and transitions between offline, online, and hybrid modes without user intervention.

## Components Supporting Offline Mode

-   **Offline Queue (`offline_queue.py`)**:
    -   Acts as a temporary local storage for all data modification operations performed while the device is disconnected from the cloud.
    -   Each operation (`SyncOperation`) captures the entity ID, type, action (create, update, delete), and the data payload.
    -   Ensures that no user-generated data is lost due to lack of connectivity.

-   **Sync Manager (`sync_manager.py`)**:
    -   Monitors network status and triggers synchronization sessions when connectivity is available.
    -   Processes the `OfflineQueue` by pushing pending operations to the cloud.
    -   Handles retries for failed sync operations, ensuring eventual consistency.

## Hybrid Mode

LifeOS operates in a **hybrid mode** by default, intelligently adapting to the current network conditions:

-   **Online**: When connected, data is synchronized in real-time or near real-time, providing an up-to-date view across all devices.
-   **Offline**: When disconnected, all operations are queued locally. The user experience remains fluid, with local data being the source of truth.
-   **Transition**: Upon re-establishing a connection, the `SyncManager` automatically initiates a sync process, pushing queued offline changes and pulling any remote updates.

## Data Persistence

Local data persistence is critical for offline functionality. The LifeOS ensures that a local copy of the user's Life Graph, Missions, Context, and Configurations is always available on the device. This local copy is kept consistent with the cloud through the synchronization process, serving as the primary data source during offline periods.

## Auto Retry Mechanism

To enhance reliability, the `SyncManager` incorporates an auto-retry mechanism for operations that fail during synchronization (e.g., due to temporary network glitches or server unavailability). Operations are retried a configurable number of times with exponential backoff, minimizing the need for manual intervention.
