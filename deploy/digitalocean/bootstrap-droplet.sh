#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/opt/mact6399capstone}"
APP_USER="${2:-$USER}"

echo "[1/8] Updating packages..."
sudo apt-get update -y
sudo apt-get install -y curl git nginx ufw

if ! command -v node >/dev/null 2>&1; then
  echo "[2/8] Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "[2/8] Node.js already installed: $(node -v)"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[3/8] Installing pm2..."
  sudo npm install -g pm2
else
  echo "[3/8] pm2 already installed"
fi

echo "[4/8] Preparing app directory..."
sudo mkdir -p "$APP_DIR"
sudo chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "[5/8] Installing Nginx site config..."
sudo cp deploy/digitalocean/nginx-mact6399capstone.conf /etc/nginx/sites-available/mact6399capstone
sudo ln -sf /etc/nginx/sites-available/mact6399capstone /etc/nginx/sites-enabled/mact6399capstone
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "[6/8] Opening firewall ports (SSH/HTTP/HTTPS)..."
sudo ufw allow OpenSSH || true
sudo ufw allow 'Nginx Full' || true
sudo ufw --force enable || true

echo "[7/8] Installing app dependencies..."
npm install

echo "[8/8] Starting app with pm2..."
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u "$APP_USER" --hp "$HOME" >/tmp/pm2-startup.txt || true

echo
 echo "Bootstrap complete."
 echo "- App dir: $APP_DIR"
 echo "- API should be available at: http://<droplet-ip>/api/provider/health?generator=mureka"
 echo "- If pm2 startup printed a command, run it with sudo now."
