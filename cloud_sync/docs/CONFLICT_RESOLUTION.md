# LifeOS Conflict Resolution

Data conflicts are an inevitable challenge in distributed systems where multiple devices can modify the same data concurrently. The LifeOS Cloud Sync system is equipped with a robust **Conflict Resolution** mechanism to ensure data integrity and consistency across all user devices.

## Conflict Detection

Conflicts are detected when the same `SyncEntity` (e.g., a Life Graph node, a Mission detail) has been modified independently on different devices since its last synchronization. The `ConflictResolver` identifies these situations by comparing:

-   **Version Numbers**: Each `SyncEntity` carries a version number that increments with every modification. A discrepancy in version numbers between local and remote entities indicates potential divergence.
-   **Checksums**: A cryptographic hash (checksum) of the entity's data payload is used to quickly determine if the content itself has changed. If versions differ and checksums also differ, a true conflict is identified.

## Resolution Strategies

The `ConflictResolver` supports several configurable strategies to automatically or semi-automatically resolve detected conflicts. The default strategy is **Last Write Wins (LWW)**, but others can be configured based on user preference or entity type.

1.  **Last Write Wins (LWW)** (`ResolutionStrategy.LAST_WRITE_WINS`)
    -   **Description**: This is the most common and often simplest strategy. When a conflict occurs, the version of the data with the most recent `last_modified` timestamp is chosen as the authoritative version.
    -   **Pros**: Simple to implement, fully automatic, ensures eventual consistency.
    -   **Cons**: Can lead to loss of data from the older modification if not carefully managed.

2.  **Remote Wins** (`ResolutionStrategy.REMOTE_WINS`)
    -   **Description**: Always prioritizes the version of the data currently stored in the cloud (remote server) over the local device's version. Local changes are discarded in favor of the remote state.
    -   **Pros**: Guarantees consistency with the central source of truth.
    -   **Cons**: All local unsynced changes in conflict are lost.

3.  **Local Wins** (`ResolutionStrategy.LOCAL_WINS`)
    -   **Description**: Always prioritizes the local device's version of the data over the remote server's version. Remote changes are overwritten by the local state.
    -   **Pros**: Ensures user's immediate changes are preserved.
    -   **Cons**: Can overwrite valid changes made on other devices.

4.  **Manual Resolution** (`ResolutionStrategy.MANUAL`)
    -   **Description**: When a conflict is detected, the system flags it and prompts the user to manually review the conflicting versions. The user is presented with both the local and remote versions and can choose which one to keep, or even merge parts of both.
    -   **Pros**: No data loss, full user control.
    -   **Cons**: Requires user intervention, can interrupt workflow, more complex to implement.

## Implementation Details

The `ConflictResolver` class in `cloud_sync/core/conflict_resolver.py` encapsulates the logic for detecting and applying these strategies. The `CloudSyncEngine` utilizes this resolver during the synchronization process to handle any detected discrepancies before pushing or pulling data. For `MANUAL` resolution, the system would typically expose an API or UI component to allow user interaction.

## Preventing Data Loss

Even with automatic resolution strategies, the system is designed to minimize data loss. The `OfflineQueue` ensures that all local changes are recorded. In cases of automatic conflict resolution, the discarded version (e.g., the older version in LWW) could potentially be archived in a `SyncHistory` for recovery purposes, although this is beyond the scope of the current implementation.
