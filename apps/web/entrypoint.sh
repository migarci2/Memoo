#!/bin/sh

set -eu

LOCKFILE="/app/package-lock.json"
LOCK_HASH_FILE="/app/node_modules/.memoo-package-lock.sha256"

mkdir -p /app/node_modules

current_lock_hash="$(sha256sum "$LOCKFILE" | awk '{print $1}')"
stored_lock_hash="$(cat "$LOCK_HASH_FILE" 2>/dev/null || true)"

needs_install=0

if [ ! -f /app/node_modules/next/package.json ]; then
  needs_install=1
fi

if [ ! -f /app/node_modules/@google/genai/package.json ]; then
  needs_install=1
fi

if [ "$current_lock_hash" != "$stored_lock_hash" ]; then
  needs_install=1
fi

if [ "$needs_install" -eq 1 ]; then
  rm -rf /app/node_modules/*
  npm ci --no-audit --no-fund
  printf '%s\n' "$current_lock_hash" > "$LOCK_HASH_FILE"
fi

exec npx next dev -H 0.0.0.0
