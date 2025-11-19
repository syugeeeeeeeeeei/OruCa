#!/bin/bash

# エラーハンドリング設定
set +e

BACKUP_ROOT="/backups"
HOST="${MYSQL_HOST:-oruca-mysql}"
USER="${MYSQL_USER:-root}"
PASS="${MYSQL_PASSWORD:-root}"
DB_NAME="${MYSQL_DATABASE:-OruCa_DB}"

# ホストIP取得（簡易的: デフォルトルートのIPを表示）
HOST_IP=$(ip route get 1 | awk '{print $7;exit}')

show_header() {
    clear
    echo "========================================"
    echo "📦 OruCa Backup Utility (Portainer Mode)"
    echo "========================================"
    echo "Database: $DB_NAME"
    echo "Host: $HOST"
    echo "Host IP (Approx): $HOST_IP"
    echo "----------------------------------------"
}

do_backup() {
    # フォルダ名: YYYYMMDD-HHMMSS
    DIR_NAME=$(date +%Y%m%d-%H%M%S)
    TARGET_DIR="${BACKUP_ROOT}/${DIR_NAME}"
    FILEPATH="${TARGET_DIR}/backup.sql"

    echo "📂 Creating directory: $TARGET_DIR ..."
    mkdir -p "$TARGET_DIR"

    echo "⏳ Dumping database to: $FILEPATH ..."
    mysqldump -h "$HOST" -u "$USER" -p"$PASS" --no-tablespaces "$DB_NAME" > "$FILEPATH"

    if [ $? -eq 0 ]; then
        echo "✅ Success! Backup created."
    else
        echo "❌ Backup Failed!"
        rm -f "$FILEPATH"
        rmdir "$TARGET_DIR" 2>/dev/null
    fi
    read -p "Press Enter to continue..."
}

do_restore() {
    echo "🔍 Searching for backup.sql files..."
    # 深さ2階層まで検索してリスト表示
    files=($(find $BACKUP_ROOT -maxdepth 3 -name "*.sql" | sort -r))

    if [ ${#files[@]} -eq 0 ]; then
        echo "❌ No backup files found in $BACKUP_ROOT"
        read -p "Press Enter to continue..."
        return
    fi

    echo "Select a backup file to restore:"
    select file in "${files[@]}" "Cancel"; do
        if [[ "$file" == "Cancel" ]]; then
            return
        elif [[ -n "$file" ]]; then
            echo "⚠️  WARNING: This will overwrite the current database!"
            read -p "Are you sure? (y/N): " confirm
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                echo "🔄 Restoring from $file ..."
                mysql -h "$HOST" -u "$USER" -p"$PASS" "$DB_NAME" < "$file"
                if [ $? -eq 0 ]; then
                    echo "✅ Restore Complete!"
                else
                    echo "❌ Restore Failed!"
                fi
            else
                echo "🚫 Cancelled."
            fi
            break
        else
            echo "Invalid selection."
        fi
    done
    read -p "Press Enter to continue..."
}

do_web_server() {
    echo "🌐 Starting Web Server (Download & Upload)..."
    echo "-----------------------------------------------------"
    echo "📥 Download List : http://${HOST_IP}:8081/"
    echo "nmh Upload Page   : http://${HOST_IP}:8081/upload"
    echo "-----------------------------------------------------"
    echo "   (Press Ctrl+C to stop the server and return to menu)"
    
    # 専用のPythonスクリプトを実行
    python3 /usr/local/bin/upload_server.py
    
    read -p "Server stopped. Press Enter to continue..."
}

while true; do
    show_header
    echo "Please select an option:"
    echo "1) 💾 Create Backup (/backups/YYYYMMDD-HHMMSS/backup.sql)"
    echo "2) 🔄 Restore Backup (Select from list)"
    echo "3) 🌐 Start File Server (Download / Upload)"
    echo "4) 🚪 Exit"
    echo ""
    read -p "Enter choice [1-4]: " choice

    case $choice in
        1) do_backup ;;
        2) do_restore ;;
        3) do_web_server ;;
        4) echo "Bye! 👋"; exit 0 ;;
        *) echo "Invalid option."; read -p "Press Enter..." ;;
    esac
done