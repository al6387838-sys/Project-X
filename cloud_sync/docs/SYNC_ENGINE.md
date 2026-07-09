# LifeOS Cloud Sync Engine

The Cloud Sync Engine is responsible for intelligently synchronizing user data across multiple devices, ensuring data consistency, availability, and integrity. It supports offline operation, incremental updates, and robust conflict resolution, all secured with End-to-End Encryption.

## Core Components

1.  **Sync Manager (`sync_manager.py`)**
    The central orchestrator for synchronization sessions. It manages the lifecycle of sync operations, tracks session history, and provides overall status. Each device maintains its own `SyncManager` instance.

2.  **Offline Queue (`offline_queue.py`)**
    A local queue that stores all data modifications made while a device is offline. These operations are automatically processed and synced once network connectivity is restored, ensuring no data loss during intermittent disconnections.

3.  **Delta Sync Engine (`delta_sync.py`)**
    Implements efficient incremental synchronization. Instead of transferring entire data objects, it calculates and transmits only the changes (deltas) since the last successful sync. This minimizes bandwidth usage and speeds up the synchronization process.

4.  **Conflict Resolver (`conflict_resolver.py`)**
    Detects and resolves data conflicts that arise when the same data is modified independently on different devices. It supports configurable resolution strategies such as 
Last Write Wins (LWW), Local Wins, and Remote Wins.

5.  **E2EE Engine (`e2ee_engine.py`)**
    Provides End-to-End Encryption for all data synchronized through the cloud. Data is encrypted on the source device and can only be decrypted by authorized target devices, ensuring privacy and security.

## Synchronization Flow

1.  **Offline Operations**: User makes changes on a device while offline. These changes are stored in the `OfflineQueue`.
2.  **Connection Restored**: When the device comes online, the `SyncManager` initiates a new sync session.
3.  **Pull Remote Changes**: The device first pulls any new changes from the cloud. Data is decrypted upon arrival.
4.  **Conflict Detection & Resolution**: For each entity, the `ConflictResolver` checks for conflicts between local and remote versions. If conflicts are found, the configured resolution strategy is applied.
5.  **Apply Deltas**: The `DeltaSyncEngine` identifies changes between the resolved local state and the previous remote state.
6.  **Push Local Changes**: Only the identified deltas are encrypted and pushed to the cloud.
7.  **History Logging**: All sync operations and sessions are logged for audit and debugging purposes.

## Key Features

-   **Offline First**: Full functionality available even without an internet connection.
-   **Incremental Sync**: Only changes are transferred, saving bandwidth and time.
-   **Conflict Resolution**: Configurable strategies to handle concurrent modifications.
-   **End-to-End Encryption**: Data privacy and security by design.
-   **Multi-Platform Support**: Designed for Web, Android, iOS, and Desktop clients.
