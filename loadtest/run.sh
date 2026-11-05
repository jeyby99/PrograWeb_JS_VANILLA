#!/usr/bin/env bash
# Runs a k6 script with Docker (no k6 install needed) and saves the reports in loadtest/reports/.
#
#   loadtest/run.sh smoke                       # against the local docker compose
#   BASE_URL=http://<elastic-ip>:8080 loadtest/run.sh stress   # against the EC2 server
#
# Reports: <script>-<timestamp>.html (k6 web dashboard) and .json (summary).
set -euo pipefail

SCRIPT="${1:?usage: run.sh <smoke|load|stress|failover> [label]}"
LABEL="${2:-$SCRIPT}"
BASE_URL="${BASE_URL:-http://host.docker.internal:8080}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR/reports"

# Git Bash on Windows rewrites /paths in arguments; this keeps them as Linux paths for Docker
export MSYS_NO_PATHCONV=1
MOUNT="$DIR"
if command -v cygpath > /dev/null; then MOUNT="$(cygpath -w "$DIR")"; fi

docker run --rm -i \
    --add-host host.docker.internal:host-gateway \
    -v "$MOUNT:/scripts" \
    -e BASE_URL="$BASE_URL" \
    -e K6_WEB_DASHBOARD=true \
    -e K6_WEB_DASHBOARD_EXPORT="/scripts/reports/$LABEL-$STAMP.html" \
    grafana/k6:1.0.0 run \
    --summary-export "/scripts/reports/$LABEL-$STAMP.json" \
    "/scripts/$SCRIPT.js"
