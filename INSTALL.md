# LifeOS Installation Guide

This guide covers the local development and testing setup for LifeOS V1.0 RC. For production deployment, please refer to [DEPLOY.md](DEPLOY.md).

## Prerequisites

- **Python:** 3.12 or higher
- **Docker:** Latest version (for observability stack)
- **Docker Compose:** V2 or higher
- **Git:** For repository management

## Step 1: Clone the Repository

```bash
git clone https://github.com/al6387838-sys/Project-X.git lifeos
cd lifeos
```

## Step 2: Set Up Python Environment

We recommend using a virtual environment to isolate dependencies.

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Upgrade pip
pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

# Install testing dependencies
pip install pytest pytest-cov pytest-asyncio
```

## Step 3: Configuration

Copy the example environment file and configure your local settings:

```bash
cp .env.example .env
```

Generate a secure encryption key for your local environment:

```bash
python3 -c "import secrets; print(f'ENCRYPTION_KEY={secrets.token_hex(32)}')" >> .env
```

## Step 4: Verify Installation

Run the complete test suite to ensure everything is functioning correctly:

```bash
python -m pytest
```

You should see all 544 tests passing.

## Step 5: Start Local Services (Optional)

If you want to run the local observability stack (Prometheus, Grafana, Loki):

```bash
# Start the monitoring stack only
docker-compose up -d prometheus grafana loki promtail
```

- **Grafana:** http://localhost:3000 (admin / lifeos_admin)
- **Prometheus:** http://localhost:9090

## Next Steps

- Read the [Architecture Overview](ARCHITECTURE.md) to understand the system.
- Check [Security Guidelines](SECURITY.md) before deploying.
