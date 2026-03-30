/**
 * rollback.js
 * Rolls a service back to its previous stable version.
 * Uses the version history maintained by deploy.js.
 */

const { auditLog, getServiceState, setServiceState, ok, err } = require("./utils");

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * rollback({ service, version })
 * If version is provided, rolls back to that exact tag.
 * Otherwise rolls back to the most recent history entry.
 */
async function rollback({ service, version = null }) {
  if (!service) return err("service name is required");

  const svc = getServiceState(service);

  if (!svc.history || svc.history.length === 0) {
    return err(`No rollback history found for ${service}. Deploy it first.`);
  }

  // Find target version
  let target;
  if (version) {
    target = svc.history.find(h => h.version === version);
    if (!target) {
      const available = svc.history.map(h => h.version).join(", ");
      return err(`Version ${version} not in history. Available: ${available}`);
    }
  } else {
    target = svc.history[0]; // most recent
  }

  const current = svc.version;

  // Simulate rollback pipeline (faster than deploy — no build/test)
  await sleep(400);

  // Update state: push current to history, restore target
  svc.history = [
    { version: current, env: svc.env, ts: new Date().toISOString(), note: "pre-rollback" },
    ...svc.history,
  ].slice(0, 10);
  svc.version = target.version;
  svc.env     = target.env || svc.env;
  setServiceState(service, svc);

  const entry = auditLog("rollback", service, { from: current, to: target.version });

  return ok(
    `⏪ Rolled back ${service}: ${current} → ${target.version} (${svc.env}). Pods healthy.`,
    { service, restoredVersion: target.version, rolledBackFrom: current, env: svc.env, auditId: entry.ts }
  );
}

/**
 * history({ service })
 * Returns the version history for a service.
 */
function history({ service }) {
  if (!service) return err("service name is required");
  const svc = getServiceState(service);
  return ok(`Version history for ${service}`, {
    current: svc.version,
    env:     svc.env,
    replicas: svc.replicas,
    history: svc.history || [],
  });
}

module.exports = { rollback, history };
