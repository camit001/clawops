/**
 * index.js
 * ClawOps DevOps Assistant — OpenClaw Skill Entry Point
 *
 * This is what OpenClaw calls. It exposes a list of tools and
 * an intent parser that maps natural language to the right action.
 */

require("dotenv").config();
const { deploy, scale }           = require("./deploy");
const { rollback, history }       = require("./rollback");
const { startWatch, stopWatch, queryLogs, injectError } = require("./logwatch");
const { readAudit, ok, err }      = require("./utils");

// ── Tool definitions (OpenClaw reads these) ───────────────────────────────────
const TOOLS = [
  {
    name: "deploy",
    description: "Deploy a service to staging or production",
    parameters: {
      service: { type: "string", required: true },
      env:     { type: "string", enum: ["staging", "production"], default: "staging" },
      version: { type: "string", required: false },
    },
  },
  {
    name: "rollback",
    description: "Roll back a service to a previous version",
    parameters: {
      service: { type: "string", required: true },
      version: { type: "string", required: false },
    },
  },
  {
    name: "scale",
    description: "Scale a service to a specific number of replicas",
    parameters: {
      service:  { type: "string",  required: true },
      replicas: { type: "integer", required: true },
    },
  },
  {
    name: "logwatch",
    description: "Start watching a service log file for errors (NemoClaw powered)",
    parameters: {
      service:         { type: "string",  required: true },
      alertThreshold:  { type: "integer", default: 5 },
    },
  },
  {
    name: "logs",
    description: "Query recent log entries for a service",
    parameters: {
      service: { type: "string", required: true },
      level:   { type: "string", enum: ["ERROR", "WARN", "INFO", "DEBUG"], required: false },
      limit:   { type: "integer", default: 20 },
    },
  },
  {
    name: "audit",
    description: "Show the infrastructure change audit trail",
    parameters: {
      service: { type: "string",  required: false },
      limit:   { type: "integer", default: 20 },
    },
  },
  {
    name: "history",
    description: "Show the version history for a service",
    parameters: {
      service: { type: "string", required: true },
    },
  },
];

// ── Natural language intent parser ────────────────────────────────────────────
// Maps user messages → { tool, params } without requiring an LLM round-trip
function parseIntent(text) {
  const t = text.toLowerCase().trim();

  // deploy
  const deployMatch = t.match(/deploy\s+([\w-]+)(?:\s+to\s+(staging|production|prod))?(?:\s+version\s+([\w.]+))?/);
  if (deployMatch) return {
    tool: "deploy",
    params: {
      service: deployMatch[1],
      env:     deployMatch[2] === "prod" ? "production" : (deployMatch[2] || "staging"),
      version: deployMatch[3] || null,
    },
  };

  // rollback
  const rollbackMatch = t.match(/roll\s*back\s+([\w-]+)(?:\s+to\s+([\w.]+))?/);
  if (rollbackMatch) return {
    tool: "rollback",
    params: { service: rollbackMatch[1], version: rollbackMatch[2] || null },
  };

  // scale
  const scaleMatch = t.match(/scale\s+([\w-]+)\s+to\s+(\d+)/);
  if (scaleMatch) return {
    tool: "scale",
    params: { service: scaleMatch[1], replicas: parseInt(scaleMatch[2]) },
  };

  // watch logs
  const watchMatch = t.match(/watch\s+logs?\s+(?:for\s+)?([\w-]+)(?:.*alert.*(\d+))?/);
  if (watchMatch) return {
    tool: "logwatch",
    params: { service: watchMatch[1], alertThreshold: parseInt(watchMatch[2] || "5") },
  };

  // query logs
  const logsMatch  = t.match(/(?:show|get|last|tail|fetch).*logs?\s+(?:for\s+)?([\w-]+)/);
  const errorMatch = t.match(/(?:errors?|warnings?)\s+in\s+([\w-]+)/);
  if (logsMatch || errorMatch) {
    const svc = (logsMatch || errorMatch)[1];
    const lvl = t.includes("error") ? "ERROR" : t.includes("warn") ? "WARN" : null;
    const lim = (t.match(/(\d+)\s+(?:lines?|entries?|logs?)/) || [])[1];
    return { tool: "logs", params: { service: svc, level: lvl, limit: parseInt(lim || "20") } };
  }

  // audit / history
  if (t.match(/audit|change.*hist|what changed/)) {
    const svcM = t.match(/for\s+([\w-]+)/);
    return { tool: "audit", params: { service: svcM ? svcM[1] : null } };
  }
  if (t.match(/history|versions?/)) {
    const svcM = t.match(/for\s+([\w-]+)|([\w-]+)\s+history/);
    const svc  = svcM ? (svcM[1] || svcM[2]) : null;
    return { tool: "history", params: { service: svc } };
  }

  return null;
}

// ── Tool dispatcher ───────────────────────────────────────────────────────────
async function runTool(tool, params) {
  switch (tool) {
    case "deploy":   return deploy(params);
    case "rollback": return rollback(params);
    case "scale":    return scale(params);
    case "logwatch": return startWatch(params.service, params.alertThreshold || 5);
    case "logs":     return queryLogs(params.service, { level: params.level, limit: params.limit });
    case "audit":    return ok("Audit trail", { entries: readAudit(params.service, params.limit || 20) });
    case "history":  return history(params);
    default:         return err(`Unknown tool: ${tool}`);
  }
}

// ── Main handler (called by OpenClaw) ─────────────────────────────────────────
async function handle({ message, tool, params }) {
  // Direct tool call (e.g. from skill UI)
  if (tool) return runTool(tool, params || {});

  // Natural language message
  if (message) {
    const intent = parseIntent(message);
    if (!intent) {
      return ok("I can help you deploy, rollback, scale, or monitor services. Try: 'deploy auth-service to staging'");
    }
    return runTool(intent.tool, intent.params);
  }

  return err("Provide either a 'message' (natural language) or a 'tool' + 'params'");
}

// ── CLI mode for testing ──────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const msg  = args.join(" ") || "deploy auth-service to staging";
  console.log(`\n🦞 ClawOps — processing: "${msg}"\n`);
  handle({ message: msg }).then(result => {
    console.log(JSON.stringify(result, null, 2));
  }).catch(console.error);
}

module.exports = { handle, TOOLS, parseIntent };
