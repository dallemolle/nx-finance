#!/bin/sh
set -e

echo "Running Prisma db push..."
npx prisma db push --accept-data-loss

echo "Starting server..."
exec "$@"
