# LifeOS Architecture

LifeOS is built on a modular, event-driven architecture designed for autonomous operation, high performance, and strict security.

## High-Level System Map

LifeOS is composed of specialized "Engines" orchestrated by the `life_kernel`.

```text
┌─────────────────────────────────────────────────────────────┐
│                       Life Orchestrator                     │
└──────┬───────────────────────┬───────────────────────┬──────┘
       │                       │                       │
┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
│  Decision   │         │   Action    │         │  Learning   │
│   Engine    │         │   Engine    │         │   Engine    │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
│ Intelligence│         │   Premium   │         │ Performance │
│     Hub     │         │     UI      │         │   Engine    │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
┌──────▼───────────────────────▼───────────────────────▼──────┐
│                         Life Kernel                         │
│   (State Management, Event Bus, Core Services)              │
└──────┬───────────────────────┬───────────────────────┬──────┘
       │                       │                       │
┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
│  Security   │         │ Cloud Sync  │         │ Connector   │
│   Center    │         │   Engine    │         │ Platform    │
└─────────────┘         └─────────────┘         └─────────────┘
```

## Core Engines

### 1. Decision Engine
The brain of LifeOS. It processes context (goals, events, patterns) to generate prioritized decisions.
- **Sub-components:** Priority Engine, Context Processor.
- **Performance:** Designed to process 1000 decisions in < 1 second.

### 2. Action Engine
Executes the decisions made by the Decision Engine.
- **Sub-components:** Rollback Manager, Execution Queue.
- **Resilience:** If an action fails, the Rollback Manager automatically restores the previous state.

### 3. Learning Engine
Analyzes outcomes to improve future decisions.
- **Sub-components:** Feedback Engine, Pattern Detector, Behavior Analyzer.
- **Mechanism:** Records implicit (routines) and explicit (user input) feedback to adjust confidence scores.

### 4. Cloud Sync Engine
Handles data persistence and multi-device synchronization.
- **Offline-First:** Uses an `OfflineQueue` to buffer operations when disconnected.
- **Delta Sync:** Computes differences to minimize bandwidth.
- **Conflict Resolution:** Handles concurrent modifications across devices.

### 5. Security Center
Provides identity, encryption, and threat monitoring. (See [SECURITY.md](SECURITY.md))

### 6. Connector Platform
Universal integration layer for external services (Google, Microsoft, Notion, etc.).
- Standardizes OAuth flows and webhook handling.

### 7. Globalization Layer
Ensures LifeOS adapts to regional formats, timezones, and languages using Babel.

## Data Flow

1. **Input:** Events arrive via the Connector Platform or UI.
2. **Contextualization:** The Intelligence Hub enriches the event with historical data.
3. **Decision:** The Decision Engine evaluates the context and outputs prioritized Actions.
4. **Execution:** The Action Engine executes the highest priority actions.
5. **Feedback:** The outcome is recorded by the Learning Engine.
6. **Persistence:** The Life Kernel updates the state, which is encrypted and synced by the Cloud Sync Engine.
