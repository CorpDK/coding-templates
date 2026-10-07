#!/bin/sh
set -e

./node_modules/.bin/drizzle-kit migrate
node dist/src/db/seed.js
exec node --import ./dist/src/observability/preload-otel.js dist/src/index.js
