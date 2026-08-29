#!/bin/sh
set -e

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-postgres}"
RUN_MIGRATIONS_ON_START="${RUN_MIGRATIONS_ON_START:-true}"

echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."

i=1
while [ $i -le 30 ]; do
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" > /dev/null 2>&1; then
    echo "PostgreSQL is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: PostgreSQL did not become ready within 30 seconds."
    exit 1
  fi
  i=$((i + 1))
  sleep 1
done

# The schema is owned by migrations, not by DB_SYNCHRONIZE. Applying them here
# keeps a clean deploy self-provisioning; `set -e` aborts the boot if any
# migration fails, so the container never serves traffic on a half-built schema.
# Set RUN_MIGRATIONS_ON_START=false when a separate release job owns migrations
# (required for multi-replica rollouts, where concurrent runners would race).
if [ "$RUN_MIGRATIONS_ON_START" = "true" ]; then
  echo "Applying database migrations..."
  node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
  echo "Migrations applied."
else
  echo "RUN_MIGRATIONS_ON_START is not 'true'; skipping migrations."
fi

exec node dist/main
