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
# 🛠️ Utility Tools (Backup & Restore)
# -----------------------------------------------------------------

# バックアップ・リストア用のTUIツールを起動します
tool:
    @echo "🚀 Starting Backup Utility TUI..."
    # --rm: 終了後にコンテナを削除
    # --service-ports: docker-compose.ymlで定義されたポート(8081)を有効にして起動
    @docker compose run --rm --service-ports backup-util