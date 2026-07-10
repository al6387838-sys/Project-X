# Changelog

All notable changes to LifeOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-rc] - 2026-07-09

### Added
- **Observability Stack:** Integrated Prometheus, Grafana, and Loki for comprehensive system monitoring.
- **Alert Manager:** Automated rule-based alerting for high error rates, latency spikes, and security threats.
- **Advanced Test Suite:** Added 28 new rigorous tests covering Stress, Security, Recovery, Performance, and Offline capabilities.
- **Deployment Scripts:** Automated bash scripts for Staging and Production deployments, including automated backups and rollback functionality.
- **Production Dockerfile:** Multi-stage, security-hardened Dockerfile running as a non-root user.
- **Documentation:** Comprehensive official documentation (README, INSTALL, DEPLOY, SECURITY, ARCHITECTURE, ROADMAP).

### Fixed
- **Decision Engine Model Mismatch:** Resolved critical schema divergence between `Decision` model and engine expectations, fixing 63 failing tests.
- **Deprecation Warnings:** Eliminated over 1200 `datetime.utcnow()` deprecation warnings across the entire codebase, migrating to `datetime.now(timezone.utc)`.
- **Timezone Bugs:** Fixed `format_relative` in the Globalization Layer to correctly handle naive vs. aware datetimes.
- **Pytest Warnings:** Resolved `PytestReturnNotNoneWarning` and `PytestCollectionWarning` in the Connector Platform test suite.
- **Event Loop Deprecation:** Updated `asyncio.get_event_loop().run_until_complete()` to `asyncio.run()` in test suites.
- **API Mismatches in RC Tests:** Fixed method signatures in `FeedbackEngine`, `AuditManager`, and `ThreatMonitor` to align with actual implementation.

### Changed
- **Test Coverage:** Achieved 100% pass rate (544 tests) with zero failures and zero warnings.
- **Security Models:** Updated default factories in dataclasses to use lambda functions for thread-safe UTC datetime generation.

### Removed
- Dead code and unused imports across `cloud_sync`, `decision_engine`, and `connector_platform`.
