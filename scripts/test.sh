#!/usr/bin/env bash
# test.sh — Run all ClawOps skill tests

set -e
cd "$(dirname "$0")/.."

echo "🦞 ClawOps — Running tests"
echo "──────────────────────────"

pass=0; fail=0

run() {
  local label="$1"; local cmd="$2"; local expect="$3"
  result=$(node skills/clawops-devops/index.js "$cmd" 2>/dev/null)
  if echo "$result" | grep -q "$expect"; then
    echo "  ✅ $label"
    pass=$((pass+1))
  else
    echo "  ❌ $label"
    echo "     Expected: $expect"
    echo "     Got: $(echo "$result" | head -2)"
    fail=$((fail+1))
  fi
}

run "Deploy to staging"        "deploy auth-service to staging"        "Deployed auth-service"
run "Deploy to production"     "deploy payment-service to production"  "Deployed payment-service"
run "Rollback service"         "rollback auth-service"                 "Rolled back"
run "Scale replicas"           "scale api-gateway to 4"                "Scaled api-gateway"
run "Query error logs"         "show errors in auth-service logs"      "ERROR"
run "Query all logs"           "show logs for payment-service"         "ok"
run "View audit trail"         "audit"                                 "Audit trail"
run "Version history"          "history for auth-service"              "current"
run "Unknown command"          "what is the meaning of life"           "I can help"

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ] && echo "🎉 All tests passed!" || exit 1
