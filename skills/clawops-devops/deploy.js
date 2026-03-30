/**
 * deploy.js
 * Handles deploy and scale actions for ClawOps.
 * In production this would call your real CI/CD API (GitHub Actions, ArgoCD, etc.)
 * Here we simulate it with realistic state management and audit logging.
 */

const { auditLog, getServiceState, setServiceState, ok, err } = require("./utils");

// Simulated pipeline stages with realistic timings
const PIPELINE_STAGES = ["build", "test", "push", "deploy"];

async function simulateStage(stage) {
  return new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
}

/**
 * deploy({ service, env, version })
 * Deploys a service to the given environment.
 */
async function deploy({ service, env = "staging", version = null }) {
  if (!service) return err("service name is required");

  const svc   = getServiceState(service);
  const prev  = svc.version;
  const next  = version || bumpPatch(prev);
  const stages = [];

  // Run simulated pipeline
  for (const stage of PIPELINE_STAGES) {
    await simulateStage(stage);
    stages.push({ stage, status: "passed", ts: new Date().toISOString() });
  }

  // Update state
  svc.history = [{ version: prev, env: svc.env, ts: new Date().toISOString() }, ...(svc.history || [])].slice(0, 10);
  svc.version = next;
  svc.env     = env;
  setServiceState(service, svc);

  // Audit trail (this is what NemoClaw watches)
  const entry = auditLog("deploy", service, { from: prev, to: next, env, stages });

  return ok(
    `✅ Deployed ${service} ${next} to ${env}. All ${PIPELINE_STAGES.length} pipeline stages passed.`,
    { service, version: next, env, previousVersion: prev, pipeline: stages, auditId: entry.ts }
  );
}

/**
 * scale({ service, replicas })
 * Scales a service to the desired replica count.
 */
async function scale({ service, replicas }) {
  if (!service)  return err("service name is required");
  if (!replicas) return err("replica count is required");

  const count = parseInt(replicas, 10);
  if (isNaN(count) || count < 1 || count > 50) return err("replicas must be between 1 and 50");

  const svc  = getServiceState(service);
  const prev = svc.replicas;
  svc.replicas = count;
  setServiceState(service, svc);

  await simulateStage("scale");
  const entry = auditLog("scale", service, { from: prev, to: count });

  return ok(
    `✅ Scaled ${service} from ${prev} → ${count} replicas.`,
    { service, replicas: count, previousReplicas: prev, auditId: entry.ts }
  );
}

// Bump the patch version: v1.2.3 → v1.2.4
function bumpPatch(ver = "v1.0.0") {
  const match = ver.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return "v1.0.1";
  return `v${match[1]}.${match[2]}.${parseInt(match[3]) + 1}`;
}

module.exports = { deploy, scale };
