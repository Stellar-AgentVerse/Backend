#!/bin/sh
set -e

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-postgres}"

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

exec node dist/main
