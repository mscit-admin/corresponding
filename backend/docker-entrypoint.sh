#!/bin/sh
set -e

echo "→ Applying database schema (prisma db push)..."
# Retry until the database accepts connections, then sync the schema.
until npx prisma db push --skip-generate --accept-data-loss; do
  echo "  Database not ready yet, retrying in 3s..."
  sleep 3
done

echo "→ Seeding database (idempotent upserts)..."
npx ts-node --transpile-only prisma/seed.ts || echo "  Seed step skipped (already seeded or failed)."

echo "→ Starting GSDMS API on port ${PORT:-3100}..."
exec node dist/main
