# ClawOps DevOps Assistant

A DevOps automation skill for OpenClaw that lets you control your entire
infrastructure through natural language. Powered by NemoClaw's secure sandbox.

## What I can do

- **Deploy** any service to staging or production via natural language
- **Rollback** to a previous stable release instantly
- **Scale** pods/containers up or down
- **Watch logs** in real time using NemoClaw's file-system intelligence
- **Alert** you when error rates spike or thresholds are breached
- **Audit** all infrastructure changes with a full history trail

## Example commands

```
deploy auth-service to staging
rollback payment-service to last stable
scale api-gateway to 5 replicas
show last 20 errors in order-service logs
watch logs for payment-service and alert on ERROR
what changed in production today?
```

## Tools exposed

| Tool | Description |
|------|-------------|
| `deploy` | Triggers CI/CD pipeline for a named service and environment |
| `rollback` | Reverts a service to its previous release tag |
| `scale` | Adjusts replica count for a service |
| `logwatch` | Streams and filters logs using NemoClaw watchers |
| `audit` | Returns the change history for a service or time range |

## Setup

See README.md in the project root for full installation instructions.
Requires NemoClaw sandbox for secure execution.
