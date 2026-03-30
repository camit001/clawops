/**
 * logwatch.js
 * The NemoClaw layer — file-system intelligence for log monitoring.
 *
 * Uses chokidar (a robust fs watcher) to watch log files in real time.
 * Filters by log level, counts error rates, and fires threshold alerts.
 * This is what makes the use of NemoClaw concrete and real.
 */

const fs      = require("fs");
const path    = require("path");
const chokidar = require("chokidar");
const { auditLog, ok, err } = require("./utils");

const LOGS_DIR   = path.join(__dirname, "../../logs-demo");
const WATCHERS   = new Map();   // service → chokidar watcher
const BUFFERS    = new Map();   // service → last N lines
const STATS      = new Map();   // service → { errors, warns, total, since }

const LEVEL_PATTERN = /\b(ERROR|WARN|INFO|DEBUG|FATAL)\b/i;
const BUFFER_SIZE   = 200;

// ── Seed demo log files ───────────────────────────────────────────────────────
function seedDemoLogs(service) {
  const file = path.join(LOGS_DIR, `${service}.log`);
  if (!fs.existsSync(file)) {
    const lines = generateDemoLines(service, 30);
    fs.writeFileSync(file, lines.join("\n") + "\n");
  }
  return file;
}

function generateDemoLines(service, count) {
  const levels = ["INFO", "INFO", "INFO", "WARN", "ERROR", "INFO", "DEBUG", "ERROR"];
  const messages = {
    INFO:  ["Request processed", "Cache hit", "DB query ok", "Health check passed"],
    WARN:  ["Slow query >200ms", "Retry attempt 1/3", "Memory at 78%"],
    ERROR: ["Connection timeout", "DB pool exhausted", "Upstream 503", "TLS handshake failed"],
    DEBUG: ["Entering handler", "Payload size 1.2KB", "Auth token valid"],
    FATAL: ["OOM killed", "Panic: nil pointer"],
  };
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const lvl = levels[Math.floor(Math.random() * levels.length)];
    const msg = messages[lvl][Math.floor(Math.random() * messages[lvl].length)];
    const ts  = new Date(now - (count - i) * 4000).toISOString();
    return `${ts} [${lvl}] [${service}] ${msg}`;
  });
}

// ── Parse a single log line ───────────────────────────────────────────────────
function parseLine(line) {
  const m = line.match(LEVEL_PATTERN);
  return { raw: line, level: m ? m[1].toUpperCase() : "INFO" };
}

// ── Watch a service log file ──────────────────────────────────────────────────
function startWatch(service, alertThreshold = 5, onAlert = null) {
  if (WATCHERS.has(service)) return ok(`Already watching ${service}`);

  const logFile = seedDemoLogs(service);
  BUFFERS.set(service, []);
  STATS.set(service, { errors: 0, warns: 0, total: 0, since: new Date().toISOString() });

  // Read existing tail first
  const existing = fs.readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean);
  const tail = existing.slice(-50);
  const buf  = BUFFERS.get(service);
  for (const line of tail) {
    const parsed = parseLine(line);
    buf.push(parsed);
    countLine(service, parsed);
  }
  if (buf.length > BUFFER_SIZE) buf.splice(0, buf.length - BUFFER_SIZE);

  let lastSize = fs.statSync(logFile).size;

  const watcher = chokidar.watch(logFile, { persistent: false, usePolling: true, interval: 500 });

  watcher.on("change", () => {
    try {
      const stat = fs.statSync(logFile);
      if (stat.size <= lastSize) return;
      const fd   = fs.openSync(logFile, "r");
      const newBytes = stat.size - lastSize;
      const buf2  = Buffer.alloc(newBytes);
      fs.readSync(fd, buf2, 0, newBytes, lastSize);
      fs.closeSync(fd);
      lastSize = stat.size;

      const newLines = buf2.toString("utf8").split("\n").filter(Boolean);
      const b = BUFFERS.get(service);
      for (const line of newLines) {
        const parsed = parseLine(line);
        b.push(parsed);
        countLine(service, parsed);

        // NemoClaw event-driven alert
        const stats = STATS.get(service);
        if (parsed.level === "ERROR" && stats.errors >= alertThreshold && onAlert) {
          onAlert({ service, level: "ERROR", errorCount: stats.errors, line: parsed.raw });
          auditLog("alert", service, { trigger: "error_threshold", count: stats.errors });
        }
      }
      if (b.length > BUFFER_SIZE) b.splice(0, b.length - BUFFER_SIZE);
    } catch (_) {}
  });

  WATCHERS.set(service, watcher);
  auditLog("logwatch_start", service, { file: logFile, alertThreshold });
  return ok(`👁 NemoClaw is now watching ${service} logs. Alert threshold: ${alertThreshold} errors.`, { logFile });
}

function countLine(service, parsed) {
  const s = STATS.get(service);
  if (!s) return;
  s.total++;
  if (parsed.level === "ERROR" || parsed.level === "FATAL") s.errors++;
  if (parsed.level === "WARN") s.warns++;
}

function stopWatch(service) {
  const w = WATCHERS.get(service);
  if (!w) return err(`Not watching ${service}`);
  w.close();
  WATCHERS.delete(service);
  return ok(`⏹ Stopped watching ${service}`);
}

// ── Query log buffer ──────────────────────────────────────────────────────────
function queryLogs(service, { level = null, limit = 20 } = {}) {
  seedDemoLogs(service); // ensure file exists
  if (!BUFFERS.has(service)) startWatch(service);

  const buf = BUFFERS.get(service) || [];
  let results = level ? buf.filter(l => l.level === level.toUpperCase()) : buf;
  results = results.slice(-limit).reverse();

  const stats = STATS.get(service) || {};
  return ok(`Last ${results.length} ${level || "all-level"} log entries for ${service}`, {
    entries: results.map(l => l.raw),
    stats,
  });
}

// ── Append a demo error (for testing alerts) ──────────────────────────────────
function injectError(service, message = "Simulated ERROR: upstream timeout") {
  const logFile = seedDemoLogs(service);
  const line = `${new Date().toISOString()} [ERROR] [${service}] ${message}\n`;
  fs.appendFileSync(logFile, line);
  return ok(`Injected error into ${service} logs`, { line: line.trim() });
}

module.exports = { startWatch, stopWatch, queryLogs, injectError };
