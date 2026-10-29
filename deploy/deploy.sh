#!/usr/bin/env bash
# Runs ON the EC2 test server. The deploy workflow copies it to /opt/prograweb
# and calls it over SSH:
#
#   deploy.sh deploy <image-tag>   DB_USERNAME=/DB_PASSWORD= lines are read from stdin
#   deploy.sh status               shows the running tag and the previous one
#
# The database credentials arrive on stdin so they never appear in a command line.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/prograweb}"
COMPOSE_FILE="docker-compose.test.yml"
IMAGE="ghcr.io/jeyby99/prograweb"
SAFE_VALUE='^[A-Za-z0-9._@%+=:-]+$'   # no spaces, quotes or "$" (they break the .env file)

cd "$APP_DIR"

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# Value of KEY in .env, or empty
env_value() {
    if [ -f .env ]; then sed -n "s/^$1=//p" .env | tail -n 1; fi
}

write_env() {   # write_env TAG USER PASSWORD
    local tmp
    tmp="$(mktemp .env.XXXXXX)"
    chmod 600 "$tmp"
    printf 'IMAGE_TAG=%s\nDB_USERNAME=%s\nDB_PASSWORD=%s\n' "$1" "$2" "$3" > "$tmp"
    mv "$tmp" .env
}

cmd_deploy() {
    local tag="${1:?usage: deploy.sh deploy <image-tag>}"
    [[ "$tag" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Invalid image tag: $tag" >&2; exit 1; }

    # Keep the current credentials unless new ones arrive on stdin
    local user pass line
    user="$(env_value DB_USERNAME)"
    pass="$(env_value DB_PASSWORD)"
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            DB_USERNAME=*) user="${line#DB_USERNAME=}" ;;
            DB_PASSWORD=*) pass="${line#DB_PASSWORD=}" ;;
        esac
    done
    user="${user:-postgres}"
    [ -n "$pass" ] || { echo "DB_PASSWORD is missing" >&2; exit 1; }
    [[ "$user" =~ $SAFE_VALUE && "$pass" =~ $SAFE_VALUE ]] || {
        echo "DB_USERNAME/DB_PASSWORD may only use letters, digits and . _ @ % + = : -" >&2; exit 1; }

    # Remember what was running, so it can be restored (rollback)
    local current
    current="$(env_value IMAGE_TAG)"
    if [ -n "$current" ] && [ "$current" != "$tag" ]; then
        echo "$current" > .previous-tag
    fi

    write_env "$tag" "$user" "$pass"
    echo "Deploying $IMAGE:$tag (previous: ${current:-none})"
    compose pull --quiet app
    compose up -d --remove-orphans
    docker image prune -f > /dev/null
    compose ps
}

cmd_status() {
    echo "IMAGE_TAG=$(env_value IMAGE_TAG)"
    echo "PREVIOUS_TAG=$(cat .previous-tag 2>/dev/null || echo none)"
    compose ps
}

case "${1:-}" in
    deploy) shift; cmd_deploy "$@" ;;
    status) cmd_status ;;
    *) echo "usage: deploy.sh {deploy <image-tag>|status}" >&2; exit 2 ;;
esac
