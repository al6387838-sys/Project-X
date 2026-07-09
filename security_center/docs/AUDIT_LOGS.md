# LifeOS Audit Logs

The LifeOS Audit Logs provide a comprehensive, immutable record of all security-relevant activities within the system. This capability is crucial for maintaining accountability, enabling forensic analysis in case of security incidents, and ensuring compliance with various regulatory standards. Every access to sensitive data, especially the Life Graph, is meticulously recorded.

## Core Principles of Audit Logging

1.  **Immutability**: Once an audit log entry is created, it cannot be altered or deleted, ensuring the integrity of the audit trail.
2.  **Granularity**: Logs capture detailed information about each event, including who performed the action, what resource was accessed, when it occurred, from where, and the outcome.
3.  **Centralization**: All audit logs are collected and stored in a centralized system, making them easily searchable and analyzable.
4.  **Transparency**: Provides users and administrators with visibility into system activities, enhancing trust and accountability.

## Audit Manager (`audit/audit_manager.py`)

The `AuditManager` module is responsible for generating, storing, and retrieving audit log entries. It acts as the central point for all auditing activities within LifeOS.

### Key Functions:

-   **`log_access(user_id: str, resource_id: str, action: str, status: str, metadata: Dict[str, Any]) -> Dict[str, Any]`**:
    -   Records an access attempt or action performed on a specific resource.
    -   **`user_id`**: The identifier of the user performing the action.
    -   **`resource_id`**: The unique identifier of the resource being accessed (e.g., a specific Life Graph node, a Mission ID).
    -   **`action`**: The type of operation performed (e.g., `READ`, `WRITE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`).
    -   **`status`**: The outcome of the action (`SUCCESS`, `FAILURE`, `DENIED`).
    -   **`metadata`**: A dictionary containing additional contextual information, such as `device_id`, `ip_address`, `location`, and any other relevant details.

-   **`get_resource_audit_trail(resource_id: str) -> List[Dict[str, Any]]`**:
    -   Retrieves a chronological list of all audit log entries related to a specific resource. This is particularly useful for understanding the history of changes or access patterns for a critical piece of data.

-   **`get_user_security_timeline(user_id: str) -> List[Dict[str, Any]]`**:
    -   Provides a timeline of all security-related events associated with a particular user. This includes login attempts, session changes, access to sensitive resources, and any security alerts.

## Audit Log Structure

Each audit log entry is a dictionary containing the following key fields:

| Field | Description | Example |
| :--- | :--- | :--- |
| `audit_id` | Unique identifier for the audit log entry. | `AUD-1678886400.123` |
| `timestamp` | UTC timestamp of when the event occurred. | `2026-07-09T12:00:00.000Z` |
| `user_id` | Identifier of the user involved. | `user_alice` |
| `resource_id` | Identifier of the resource accessed. | `life_graph_node_xyz` |
| `action` | Type of action performed. | `READ` |
| `status` | Outcome of the action. | `SUCCESS` |
| `device_id` | Device from which the action originated. | `mobile_phone_1` |
| `ip_address` | IP address of the client. | `203.0.113.45` |
| `context` | Additional contextual data. | `{"browser": "Chrome"}` |

## Security Timeline

The `Security Timeline` is a specialized view generated from the audit logs, focusing on events that impact the security posture of a user or the system. It helps administrators and users quickly identify patterns, investigate suspicious activities, and understand the sequence of events leading to a security incident.

## Auditing the Life Graph

One of the most critical aspects of LifeOS audit logging is the comprehensive tracking of all access to the **Life Graph**. Every read, write, update, or deletion of a Life Graph node or relationship is logged, providing an unalterable record of how a user's personal data evolves and who accessed it. This ensures:

-   **Data Provenance**: Clear understanding of where data originated and how it was modified.
-   **Compliance**: Meeting requirements for data access logging in sensitive personal data systems.
-   **Forensic Readiness**: Ability to reconstruct events in case of unauthorized access or data tampering.

By integrating robust audit logging, LifeOS reinforces its commitment to security, transparency, and user trust within its Zero Trust framework.
