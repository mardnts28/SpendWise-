#!/usr/bin/env bash
set -e

# SpendWise Database Backup Script
# Usage: ./scripts/backup.sh

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_NAME="${PGDATABASE:-spendwise_db}"
DB_USER="${PGUSER:-maryardientes}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "==> Creating backup of ${DB_NAME} to ${FILENAME}..."
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -F c -b -v -f "${FILENAME}" "${DB_NAME}"

echo "==> Backup completed successfully!"
ls -lh "${FILENAME}"

# Optional: keep only the last 7 backups
echo "==> Cleaning old backups (keeping latest 7)..."
find "${BACKUP_DIR}" -name "${DB_NAME}_backup_*.dump" -type f | sort -r | tail -n +8 | xargs -r rm -f
echo "==> Done."
