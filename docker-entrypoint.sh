#!/bin/sh
set -eu

data_dir="${DATA_DIR:-/data}"
mkdir -p "$data_dir"

if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs "$data_dir"
  exec su-exec nextjs:nodejs node server.js
fi

exec node server.js
