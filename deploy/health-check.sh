#!/usr/bin/env bash
# Checks that a deployed PrograWeb answers correctly. Runs on the GitHub runner
# (or any machine with curl) after a deployment:
#
#   health-check.sh http://<host>:8080 [timeout-seconds]
#
# 1) waits until GET /api/entidades answers 200 (the app is up AND reaches PostgreSQL)
# 2) checks that the pages /, /pagina1.html and /pagina2.html answer 200
set -euo pipefail

BASE_URL="${1:?usage: health-check.sh <base-url> [timeout-seconds]}"
TIMEOUT="${2:-120}"
BASE_URL="${BASE_URL%/}"

status_of() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE_URL$1" || true; }

echo "Waiting up to ${TIMEOUT}s for $BASE_URL/api/entidades ..."
deadline=$((SECONDS + TIMEOUT))
until [ "$(status_of /api/entidades)" = "200" ]; do
    if [ "$SECONDS" -ge "$deadline" ]; then
        echo "::error title=Health check failed::$BASE_URL/api/entidades did not answer 200 within ${TIMEOUT}s"
        exit 1
    fi
    sleep 5
done
echo "OK  /api/entidades"

failed=0
for path in / /pagina1.html /pagina2.html; do
    code="$(status_of "$path")"
    if [ "$code" = "200" ]; then
        echo "OK  $path"
    else
        echo "::error title=Health check failed::$BASE_URL$path answered $code"
        failed=1
    fi
done
exit "$failed"
