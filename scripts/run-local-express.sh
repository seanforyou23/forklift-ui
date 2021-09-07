#!/bin/bash
_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export META_FILE="$_dir/../config/meta.dev.json"
export STATIC_DIR="$_dir/../dist"
mkdir -p "$STATIC_DIR"
cd $_dir/..
if [ "$1" == "--auto-reload" ]; then
  node --trace-warnings --trace-deprecation $_dir/../modules/api/node_modules/nodemon/bin/nodemon.js --config $_dir/../modules/api/nodemon.json $_dir/../modules/api/server.ts
else
  node --trace-warnings --trace-deprecation $_dir/../modules/api/dist/server.js
fi
