#!/usr/bin/env bash
# One-time preparation of the EC2 test server (SCRUM-15, SCRUM-29). Run it once, as root,
# from an SSH or EC2 Instance Connect session:
#
#   curl -fsSL https://raw.githubusercontent.com/jeyby99/PrograWeb_JS_VANILLA/dev/deploy/server-setup.sh | sudo bash
#
# It is safe to run again: every step checks first. It installs Docker and the Compose
# plugin, adds 2 GB of swap (a t3.micro has only 1 GB of RAM) and creates /opt/prograweb.
set -euo pipefail

COMPOSE_VERSION="v2.29.7"
SWAP_FILE=/swapfile
SWAP_SIZE=2G
APP_DIR=/opt/prograweb

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo bash)" >&2; exit 1; }

# The login user of the image: ec2-user on Amazon Linux, ubuntu on Ubuntu
if id ec2-user > /dev/null 2>&1; then APP_USER=ec2-user; else APP_USER=ubuntu; fi

echo "== Docker"
if ! command -v docker > /dev/null; then
    if command -v dnf > /dev/null; then
        dnf install -y docker
    else
        apt-get update -y && apt-get install -y docker.io
    fi
fi
systemctl enable --now docker
usermod -aG docker "$APP_USER"

echo "== Docker Compose plugin"
if ! docker compose version > /dev/null 2>&1; then
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-linux-$(uname -m)" \
        -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

echo "== Swap ($SWAP_SIZE)"
if ! swapon --show | grep -q "$SWAP_FILE"; then
    [ -f "$SWAP_FILE" ] || fallocate -l "$SWAP_SIZE" "$SWAP_FILE"
    chmod 600 "$SWAP_FILE"
    mkswap "$SWAP_FILE"
    swapon "$SWAP_FILE"
    grep -q "^$SWAP_FILE " /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
fi
# Use the swap only when RAM is really short
sysctl -q vm.swappiness=10
echo "vm.swappiness=10" > /etc/sysctl.d/99-prograweb-swap.conf

echo "== App folder $APP_DIR (owner $APP_USER)"
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

echo
echo "Done. Log out and back in so $APP_USER can use docker without sudo, then check:"
echo "  docker compose version && free -h && ls -ld $APP_DIR"
