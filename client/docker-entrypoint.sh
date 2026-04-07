#!/bin/sh
# Generate self-signed SSL cert only if it doesn't already exist (persisted via volume)
if [ ! -f /etc/nginx/ssl/cert.pem ] || [ ! -f /etc/nginx/ssl/key.pem ]; then
  echo "[SSL] Generating new self-signed certificate..."
  mkdir -p /etc/nginx/ssl
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/C=BE/ST=Brussels/L=Brussels/O=MeteorEdit/CN=meteoredit.local" \
    -addext "subjectAltName=DNS:meteoredit.local,DNS:localhost,IP:100.64.0.2,IP:127.0.0.1"
else
  echo "[SSL] Using existing certificate."
fi
