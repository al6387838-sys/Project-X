# LifeOS Security Center

The LifeOS Security Center provides a unified dashboard and a comprehensive set of tools for managing and monitoring the security posture of a user's LifeOS instance. It integrates all Zero Trust components to offer a clear overview of identity, device, and behavioral trust, along with real-time threat detection and audit capabilities.

## Key Features

1.  **Security Score**:
    -   A quantitative measure (0-100) of the overall security health of the user's LifeOS. It aggregates factors like Passkey adoption, trusted device registration, and real-time trust evaluations.
    -   Calculated by the `SecurityCenter` class in `core/security_center.py`.

2.  **Trust Dashboard**:
    -   Visual representation of the current trust levels for identity, devices, and ongoing sessions.
    -   Highlights any active security alerts or anomalies detected by the `ThreatMonitor`.

3.  **Identity Monitor**:
    -   Displays registered Passkeys (FIDO2/WebAuthn credentials) and their usage history.
    -   Allows users to manage their authentication methods, including Multi-Factor Authentication (MFA) settings and recovery keys.

4.  **Device Monitor**:
    -   Lists all registered devices, their trust status, and last activity.
    -   Enables users to revoke trust from lost or compromised devices, triggering automatic session termination.

5.  **Threat Monitor Integration**:
    -   Provides a real-time feed of security alerts, such as suspicious login attempts, unusual location changes, or anomalous behavior.
    -   Allows users to review and act upon detected threats, initiating actions like session revocation or password resets.

6.  **Audit Logs & Security Timeline**:
    -   Offers a detailed, immutable record of all security-relevant events, including login attempts, access to sensitive data (Life Graph), configuration changes, and administrative actions.
    -   The `Security Timeline` provides a chronological view of these events, aiding in forensic analysis and compliance.

## Security Score Calculation

The `SecurityCenter.calculate_security_score()` method combines various security indicators to produce a single, actionable score:

| Factor | Weight | Description |
| :--- | :---: | :--- |
| **Identity Trust** | 40% | Based on the adoption of strong authentication methods like Passkeys. Higher weight for phishing-resistant credentials. |
| **Device Trust** | 30% | Reflects the number of registered trusted devices and their security posture (e.g., up-to-date OS, no known vulnerabilities). |
| **Continuous Trust Evaluation** | 30% | Derived from the `ZeroTrustEngine`'s real-time assessment of user and device behavior, location, and context. |

*A higher score indicates a more secure LifeOS environment.*

## User Actions within the Security Center

-   **Register/Manage Passkeys**: Users can easily add new Passkeys or manage existing ones.
-   **Manage Trusted Devices**: Add, remove, or revoke trust from devices.
-   **Review Security Alerts**: Investigate and dismiss alerts from the `ThreatMonitor`.
-   **View Audit Trails**: Access detailed logs of activities for transparency and accountability.
-   **Initiate Emergency Actions**: For critical situations, users can trigger actions like revoking all sessions or resetting security credentials.

## Integration with LifeOS

The Security Center is deeply integrated into the LifeOS core, ensuring that security is not an afterthought but an intrinsic part of the user experience. All modules, from the `Life Graph` to the `Companion`, leverage the Security Center's capabilities to enforce Zero Trust principles continuously.
