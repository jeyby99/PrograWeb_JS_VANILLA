#!/usr/bin/env bash
# Local failover demo: runs failover.js and, during the run, stops and starts one instance.
#
#   loadtest/failover-demo.sh good    # gateway with the good balancer (default profile)
#   loadtest/failover-demo.sh bad     # gateway with GATEWAY_PROFILE=bad-balancer
#
# On the EC2 server do the same by hand: run failover.js from the PC (run.sh) and, over SSH,
# "docker compose stop app2" at ~0:30 and "docker compose start app2" at ~1:30.
set -euo pipefail

MODE="${1:?usage: failover-demo.sh <good|bad>}"
INSTANCE="${INSTANCE:-app2}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/.."

case "$MODE" in
    good) PROFILE=default ;;
    bad)  PROFILE=bad-balancer ;;
    *) echo "mode must be good or bad" >&2; exit 2 ;;
esac

echo "Gateway profile: $PROFILE"
# --no-deps: restart only the gateway
GATEWAY_PROFILE="$PROFILE" docker compose up -d --no-deps gateway
until curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/actuator/health | grep -q 200; do sleep 2; done
sleep 8   # let the load balancer's first health check run

(
    sleep 30; echo ">>> stopping $INSTANCE";  docker compose stop "$INSTANCE"
    sleep 60; echo ">>> starting $INSTANCE";  docker compose start "$INSTANCE"
) &
CHAOS=$!

"$DIR/run.sh" failover "failover-$MODE" || true
wait "$CHAOS"
