# 🦞 ClawOps — AI-Powered DevOps Assistant

> **LTSS Claw Innovation Challenge submission**
> Combines **Open Claw** (workflow orchestration) + **Nemo Claw** (file-system intelligence)
> to create a DevOps assistant you control through natural language.

---

## What it does

ClawOps lets you manage your entire infrastructure by chatting with your Open Claw assistant.
No dashboards, no kubectl memorisation — just plain English.

```
You:  deploy auth-service to staging
Bot:  ✅ Deployed auth-service v1.2.4 to staging. All 4 pipeline stages passed.

You:  show last 10 errors in payment-service logs
Bot:  Last 6 ERROR entries for payment-service:
      2026-03-30 [ERROR] Connection timeout
      2026-03-30 [ERROR] DB pool exhausted ...

You:  rollback payment-service
Bot:  ⏪ Rolled back payment-service: v1.2.4 → v1.2.3. Pods healthy.

You:  scale api-gateway to 5
Bot:  ✅ Scaled api-gateway from 2 → 5 replicas.
```

---

## How Open Claw is used

Open Claw is the **conversation and orchestration layer**.

- ClawOps is built as a native **Open Claw Skill** (`skills/clawops-devops/`)
- The skill exposes 7 tools: `deploy`, `rollback`, `scale`, `logwatch`, `logs`, `audit`, `history`
- A lightweight **intent parser** (`index.js`) maps natural language to the correct tool without needing an LLM round-trip for every command — fast and offline-capable
- The **Lobster workflow** (`.agent/workflows/devops-pipeline.yaml`) chains deploy → watch → verify → auto-rollback into a single production-safe pipeline

## How Nemo Claw is used

Nemo Claw is the **file-system intelligence layer** — this is where the real-time magic happens.

- `logwatch.js` uses `chokidar` (a battle-tested fs watcher) to monitor log files byte-by-byte as they grow
- Every new log line is parsed for level (`ERROR`, `WARN`, `INFO`)
- When error count crosses a configurable threshold, Nemo Claw fires an **event-driven alert** back to the Open Claw chatbot — no polling, no cron jobs
- All watch events, alerts, and infra changes are written to a structured **audit log** that Nemo Claw monitors for change detection
- Configured in `config.yaml` under `nemoclaw.watch_dirs`

---

## Project structure

```
clawops/
├── skills/clawops-devops/
│   ├── index.js        ← OpenClaw skill entry + intent parser
│   ├── deploy.js       ← deploy & scale actions
│   ├── rollback.js     ← rollback & history
│   ├── logwatch.js     ← NemoClaw file-system watcher layer
│   ├── utils.js        ← audit log, state store, helpers
│   ├── skill.md        ← OpenClaw skill manifest
│   └── package.json
├── .agent/workflows/
│   └── devops-pipeline.yaml   ← Lobster production pipeline
├── logs-demo/          ← NemoClaw watches this directory
├── scripts/
│   ├── setup.sh        ← one-command install
│   └── test.sh         ← automated test suite (9 tests)
├── docs/
│   └── writeup.md      ← 2-page innovation writeup
├── config.yaml         ← OpenClaw + NemoClaw config
└── .env.example        ← environment variable template
```

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- [Open Claw](https://openclaw.im) installed and onboarded
- [Nemo Claw](https://github.com/NVIDIA/NemoClaw) (optional — for sandboxed execution)

### One-command setup

```bash
git clone https://github.com/your-username/clawops
cd clawops
bash scripts/setup.sh
```

This will:
1. Install Open Claw (if not present)
2. Install Nemo Claw sandbox (if not present)
3. Install Node.js dependencies
4. Copy `.env.example` → `.env`
5. Register the skill with Open Claw

### Manual setup

```bash
cd clawops
npm install --prefix skills/clawops-devops
cp .env.example .env
# fill in .env with your API keys
openclaw skills install ./skills/clawops-devops
```

### Test it without Open Claw (CLI mode)

```bash
node skills/clawops-devops/index.js "deploy auth-service to staging"
node skills/clawops-devops/index.js "show errors in auth-service logs"
node skills/clawops-devops/index.js "rollback auth-service"
node skills/clawops-devops/index.js "scale api-gateway to 5"
node skills/clawops-devops/index.js "audit"
```

### Run the full test suite

```bash
bash scripts/test.sh
```

Expected output: `9 passed, 0 failed`

---

## Supported commands

| Natural language | Action |
|---|---|
| `deploy <service> to staging/production` | Runs build → test → push → deploy pipeline |
| `deploy <service> version v1.2.3` | Deploy a specific version tag |
| `rollback <service>` | Revert to previous release |
| `rollback <service> to v1.2.0` | Revert to a specific version |
| `scale <service> to N replicas` | Adjust replica count |
| `watch logs for <service>` | Start NemoClaw real-time log monitor |
| `show logs for <service>` | Query last 20 log entries |
| `show errors in <service> logs` | Filter ERROR-level entries only |
| `audit` / `what changed today` | Show infrastructure change trail |
| `history for <service>` | Show version history |

---

## Connecting to real infrastructure

Edit `.env` with your credentials. Each integration is **opt-in** — the skill works without any of them using simulation mode:

- **GitHub Actions**: set `GITHUB_TOKEN` + `GITHUB_ORG`, then update `deploy.js` to call the Actions API
- **Kubernetes**: set `KUBECONFIG`, then swap simulated commands for `kubectl` calls in `deploy.js` and `rollback.js`
- **Slack alerts**: set `SLACK_WEBHOOK_URL` for NemoClaw alerts to post to a channel

---

## License

MIT — see [LICENSE](./LICENSE)
