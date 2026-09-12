# FYK Prod-Readiness Command Center

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              AUDIT COMMAND CENTER                     │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ FYK      │  │ Sunbird  │  │ Arena.ai         │  │
│  │ (local)  │  │ (github) │  │ (expert prompts) │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                  │             │
│       ▼              ▼                  ▼             │
│  ┌──────────────────────────────────────────────┐   │
│  │           UNIFIED AUDIT ENGINE                │   │
│  │  • Type checking    • Linting                 │   │
│  │  • Tests            • Build verification      │   │
│  │  • Security scan    • Dead code detection     │   │
│  │  • Bundle analysis  • Performance profiling   │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                                │
│                     ▼                                │
│  ┌──────────────────────────────────────────────┐   │
│  │           INFER ENGINE                        │   │
│  │  • Reads audit results                        │   │
│  │  • Generates arena.ai prompts                 │   │
│  │  • Recommends next actions                    │   │
│  │  • Prioritizes by impact                      │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                                │
│                     ▼                                │
│  ┌──────────────────────────────────────────────┐   │
│  │           SCHEDULER (every 10-15 min)         │   │
│  │  • Cron job triggers audit                    │   │
│  │  • Results saved to agent/audit-system/logs/  │   │
│  │  • Progress tracked in dashboard              │   │
│  └──────────────────────────────────────────────┘   │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## How It Works

1. **Every 10 min**: Full audit runs on fyk-consolidated (typecheck, lint, test, build, security)
2. **Every 15 min**: Sunbird repo checked for updates, cross-repo patterns inferred
3. **After each audit**: Arena.ai prompts generated with expert context
4. **Continuous**: Progress tracked, trends analyzed, next actions inferred

## Files

| File | Purpose |
|------|---------|
| `audit-fyk.sh` | Main fyk-consolidated audit script |
| `audit-sunbird.sh` | Sunbird repo audit script |
| `infer-engine.sh` | Reads results, generates arena.ai prompts |
| `dashboard.sh` | Live progress dashboard |
| `arena-prompts.sh` | Generates expert prompts for arena.ai |
| `config.sh` | Configuration and thresholds |
| `run-loop.sh` | Master loop that orchestrates everything |

## Quick Start

```bash
# Run full audit now
./agent/audit-system/run-loop.sh

# Start the automated loop (background)
./agent/audit-system/run-loop.sh --daemon

# Check dashboard
./agent/audit-system/dashboard.sh
```
