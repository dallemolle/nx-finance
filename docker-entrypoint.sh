#!/bin/sh
set -e

echo "Running Prisma db push..."
npx --no-install prisma db push --accept-data-loss --skip-generate

echo "Starting server..."
exec "$@"
