# LifeOS Deployment Guide

This document outlines the deployment procedures for LifeOS V1.0 RC across Staging and Production environments.

## Architecture

The deployment architecture utilizes Docker and Docker Compose, providing an isolated, reproducible environment containing:

1. **LifeOS Core:** The main Python application running the engines.
2. **Prometheus:** Metrics collection and storage.
3. **Grafana:** Dashboards and visualization.
4. **Loki:** Log aggregation.
5. **Promtail:** Log shipping from LifeOS to Loki.

## Prerequisites

- A Linux server (Ubuntu 22.04/24.04 recommended)
- Docker and Docker Compose installed
- Port 80/443 available (if using a reverse proxy)
- At least 4GB RAM and 2 CPU cores

## Pre-Deployment Setup

1. Clone the repository on the target server.
2. Create the required directories:
   ```bash
   mkdir -p deploy/prometheus deploy/grafana/dashboards deploy/loki deploy/promtail deploy/scripts backups logs
   ```
3. Copy `.env.example` to `.env` and fill in production values. **Ensure `ENCRYPTION_KEY` is securely generated and backed up.**

## Staging Deployment

The staging environment uses override configurations to run alongside production or on a dedicated testing server.

```bash
# Execute the staging deploy script
./deploy/scripts/deploy_staging.sh
```

This script will:
1. Run the test suite.
2. Build the Docker image.
3. Deploy using `docker-compose.staging.yml` overrides (exposing Grafana on port 13000).

## Production Deployment

The production deployment script includes automated backups, health checks, and verification.

```bash
# Execute the production deploy script
./deploy/scripts/deploy_production.sh
```

The deployment pipeline executes the following steps:
1. **Pre-flight Checks:** Verifies Docker and environment variables.
2. **Backup:** Creates a full backup of the data volume and configuration.
3. **Tests:** Runs the full test suite to prevent broken builds from deploying.
4. **Build:** Builds the optimized multi-stage Docker image.
5. **Deploy:** Starts the services.
6. **Health Check:** Polls the application until it reports healthy.

## Automated Backups

Set up a cron job to run the backup script daily:

```bash
# Edit crontab
crontab -e

# Add the following line (runs at 2:00 AM daily)
0 2 * * * cd /path/to/lifeos && ./deploy/scripts/backup.sh >> /path/to/lifeos/logs/cron_backup.log 2>&1
```

## Rollback Procedure

If a deployment fails or exhibits critical issues, you can instantly rollback to the previous version:

```bash
# Rollback to the most recent backup
./deploy/scripts/rollback.sh

# Or rollback to a specific backup
./deploy/scripts/rollback.sh ./backups/lifeos_backup_1.0.0-rc_20260709_120000
```
