/**
 * utils.js
 * Shared helpers used across all ClawOps skill modules.
 */

const fs   = require("fs");
const path = require("path");

// ── Audit log ─────────────────────────────────────────────────────────────────
const AUDIT_FILE = path.join(__dirname, "../../logs-demo/audit.log");

function auditLog(action, service, meta = {}) {
  const entry = {
    ts:      new Date().toISOString(),
    action,
    service,
    ...meta,
  };
  fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + "\n");
  return entry;
}

function readAudit(service = null, limit = 20) {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  const lines = fs.readFileSync(AUDIT_FILE, "utf8").trim().split("\n").filter(Boolean);
  const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const filtered = service ? entries.filter(e => e.service === service) : entries;
  return filtered.slice(-limit).reverse();
}

// ── Simple version store (flat JSON file acting as a DB) ─────────────────────
const STATE_FILE = path.join(__dirname, "../../logs-demo/state.json");

function readState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getServiceState(service) {
  const state = readState();
  return state[service] || { version: "v1.0.0", replicas: 2, env: "staging", history: [] };
}

function setServiceState(service, data) {
  const state = readState();
  state[service] = data;
  writeState(state);
}

// ── Response formatting ────────────────────────────────────────────────────────
function ok(msg, data = {})  { return { status: "ok",    message: msg, ...data }; }
function err(msg, data = {}) { return { status: "error", message: msg, ...data }; }

module.exports = { auditLog, readAudit, getServiceState, setServiceState, ok, err };
