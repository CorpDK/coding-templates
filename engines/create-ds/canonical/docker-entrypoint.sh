#!/bin/sh
set -e

# Existing compose volumes skip postgres-init; scalar_specimens needs citext.
node --input-type=module -e "
import pg from 'pg';
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query('CREATE EXTENSION IF NOT EXISTS citext');
await client.end();
"

./node_modules/.bin/drizzle-kit migrate
node dist/src/db/seed.js
exec node --import ./dist/src/observability/preload-otel.js dist/src/index.js
