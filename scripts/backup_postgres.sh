#!/bin/sh
# Sao lưu PostgreSQL của Thue ERP. Chạy trên máy chủ, cùng thư mục với compose.yaml.
# Dùng:  BACKUP_DIR=/var/backups/thue RETENTION_DAYS=30 sh scripts/backup_postgres.sh
# Cần chép BACKUP_DIR sang máy khác: bản sao nằm cùng máy chủ không bảo vệ được khi hỏng ổ đĩa.
# Khôi phục (vào database trống, không ghi đè database đang dùng):
#   gunzip -c <file>.sql.gz | docker compose exec -T postgres psql -U "$DB_USER" -d <database_trong>
set -eu

BACKUP_DIR=${BACKUP_DIR:-./backups}
RETENTION_DAYS=${RETENTION_DAYS:-30}
DB_USER=${DB_USER:-thue_erp}
DB_NAME=${DB_NAME:-thue_erp}

mkdir -p "$BACKUP_DIR"
target="$BACKUP_DIR/thue_$(date +%Y%m%d_%H%M%S).sql.gz"

docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner | gzip > "$target.tmp"
gzip -t "$target.tmp"
mv "$target.tmp" "$target"

find "$BACKUP_DIR" -name 'thue_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Đã sao lưu: $target"
