#!/bin/sh
set -e

./node_modules/.bin/drizzle-kit migrate
node dist/src/db/seed.js
exec node dist/src/index.js
