# /OruCa/justfile

_default:
  @just --list -u

# -----------------------------------------------------------------
# 💡 シェル設定
# -----------------------------------------------------------------
# sh: 1: [[: not found エラーを回避するため、レシピの実行シェルを bash に変更します。
set shell := ["bash", "-cu"]

up:
  @docker compose -f docker-compose.yml -f compose.dev.yml --env-file .env.example up -d --build

down:
  @docker compose -f docker-compose.yml -f compose.dev.yml --env-file .env.example down

# -----------------------------------------------------------------
# 💾 Database Backup & Restore
# -----------------------------------------------------------------

# バックアップ設定 (現在日時と保存先ルート)
timestamp := `date +%Y%m%d-%H%M%S`
backup_root := "mysql/backups"

# DBバックアップを実行 (保存先: mysql/backups/YYYYMMDD-HHMMSS/backup.sql)
save-backup:
    @echo "💾 Saving database backup..."
    @mkdir -p {{backup_root}}/{{timestamp}}
    @echo "   Backup directory: {{backup_root}}/{{timestamp}}"
    # mysqldumpを実行し、ホスト側のファイルにリダイレクト
    # コンテナ内の環境変数($MYSQL_...)を展開させるため、シングルクォートでコマンドを囲む
    docker compose exec -T mysql sh -c 'mysqldump --no-tablespaces -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > {{backup_root}}/{{timestamp}}/backup.sql
    @echo "✅ Database backup saved to {{backup_root}}/{{timestamp}}/backup.sql"

# DBリストアを実行 (引数: バックアップディレクトリ名)
# 使用例: just restore-backup 20250101-120000
restore-backup backup_id:
    #!/usr/bin/env bash
    set -e # エラー発生時に即終了

    BACKUP_FILE="{{backup_root}}/{{backup_id}}/backup.sql"

    # バックアップファイルの存在確認
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "❌ Error: Backup file '$BACKUP_FILE' not found."
        exit 1
    fi

    echo "🔄 Restoring database from $BACKUP_FILE..."

    # SQLファイルをコンテナ内のmysqlコマンドに流し込む
    cat "$BACKUP_FILE" | docker compose exec -T mysql sh -c 'mysql -vvv -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'

    echo "✅ Database restored successfully."
