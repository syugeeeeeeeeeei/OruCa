# OruCa

OruCa は FeliCa カードを使って研究室メンバーの在室状況を記録・表示する Web アプリです。  
このリポジトリは Lab-Core v3 上でそのまま登録・起動できる構成に合わせています。

## Lab-Core 登録値

- `composePath`: `docker-compose.yml`
- `publicServiceName`: `web`
- `publicPort`: `80`
- `mode`: `standard`
- `deviceRequirements`: `["/dev/bus/usb"]`
- `keepVolumesOnRebuild`: `true`

登録テンプレート:

```json
{
  "name": "oruca",
  "description": "FeliCa 在室管理システム",
  "repositoryUrl": "https://github.com/<org>/<repo>",
  "defaultBranch": "main",
  "composePath": "docker-compose.yml",
  "publicServiceName": "web",
  "publicPort": 80,
  "hostname": "oruca.fukaya-sus.lab",
  "mode": "standard",
  "keepVolumesOnRebuild": true,
  "deviceRequirements": ["/dev/bus/usb"]
}
```

## リポジトリ構成

```text
OruCa/
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── README.md
├── api/
├── nfc/
├── vite/
└── web/
```

## 起動方法

1. リポジトリを clone します。

```bash
git clone https://github.com/<org>/<repo>.git
cd OruCa
```

2. 必要なら `.env.example` を `.env` にコピーして値を調整します。

```bash
cp .env.example .env
```

3. 本番構成を起動します。

```bash
docker compose -f docker-compose.yml up -d --build
```

デバッグ管理者ログインを有効にして起動する場合:

```bash
docker compose -f docker-compose.yml -f compose.debug.yml up -d --build
```

Lab-Core では `web` サービスが内部で `80` 番ポートを listen し、Nginx から API にプロキシされます。

## 環境変数

必須ではない場合でも、必要に応じて `.env` または compose 実行環境で上書きできます。

| 変数名 | 必須 | 既定値 | 用途 |
| --- | --- | --- | --- |
| `MYSQL_DATABASE` | 任意 | `OruCa_DB` | MySQL データベース名 |
| `MYSQL_USER` | 任意 | `OruCa_user` | MySQL ユーザー名 |
| `MYSQL_PASSWORD` | 任意 | `OruCa_user_pass` | MySQL ユーザーパスワード |
| `MYSQL_ROOT_PASSWORD` | 任意 | `root` | MySQL root パスワード |
| `APPDATA_ROOT` | 任意 | `../../appdata/oruca` | 永続データ保存先 |
| `ADMIN_FIXED_PASSWORD` | 必須 | なし | 管理者ログインの固定パスワード |
| `DEBUG_ADMIN_ENABLED` | 任意 | `false` | デバッグ管理者ログインを有効化するフラグ |
| `DEBUG_ADMIN_USER` | 任意 | `test-user` | デバッグ管理者ユーザー名 |
| `DEBUG_ADMIN_PASSWORD` | 任意 | `test-password` | デバッグ管理者パスワード |
| `SLACK_TOKEN_ENC_KEY` | 任意 | 空 | Slack Botトークン暗号化キー（未設定時はSlackトークン保存不可） |
| `BACKUP_DIR` | 任意 | `/backups` | APIコンテナ内のバックアップ保存先 |

`ADMIN_FIXED_PASSWORD` は必須です。  
`DEBUG_ADMIN_ENABLED=true` のときは `DEBUG_ADMIN_USER` / `DEBUG_ADMIN_PASSWORD` で管理画面ログインできます。  
Slack通知は未設定でもアプリは起動します。  
永続設定をソース外に置きたい場合は `${APPDATA_ROOT}/config/api.env` を作成すると、API コンテナ起動時に自動で読み込みます。

## 永続データの保存先

- MySQL データ: `${APPDATA_ROOT}/mysql`
- バックアップ保存先: `${APPDATA_ROOT}/backups`
- 永続設定ファイル: `${APPDATA_ROOT}/config/api.env`

`APPDATA_ROOT` の既定値は Lab-Core の `runtime/apps/<app>` から見て `../../appdata/oruca` です。  
これにより再ビルド後も DB データと設定を保持できます。

## デバイス要件

このアプリは NFC リーダーのために USB デバイスアクセスが必要です。

- compose 側: `devices: ["/dev/bus/usb:/dev/bus/usb"]`
- Lab-Core 登録値: `deviceRequirements: ["/dev/bus/usb"]`

WSL 環境では必要に応じて `usb-wsl-attach.ps1` を使って USB を接続してください。

## 障害時の確認コマンド

```bash
docker compose -f docker-compose.yml config --services
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml logs --no-color --tail 200
docker compose -f docker-compose.yml restart
docker compose -f docker-compose.yml down
```

個別サービスのログ例:

```bash
docker compose -f docker-compose.yml logs --no-color --tail 200 web
docker compose -f docker-compose.yml logs --no-color --tail 200 api
docker compose -f docker-compose.yml logs --no-color --tail 200 nfc
docker compose -f docker-compose.yml logs --no-color --tail 200 mysql
```

## 管理画面でできること

- 学籍番号で登録済みのユーザー名更新 / 削除
- Slack通知設定（チャンネルID、Botトークン保存）
  - BotトークンはDBに暗号化して保存され、画面には再表示されません
- MySQLバックアップ作成
- バックアップ一覧表示
- バックアップからのリストア
  - 実行前に自動で退避バックアップを作成します

## 補足

- `web` は `/health` を返すため、ヘルスチェック可能です。
- API と NFC は compose のサービス名 `api`, `mysql` を使って接続するため、固定コンテナ名に依存しません。
- ログは各サービスとも標準出力 / 標準エラーに出力されるため、Lab-Core のログ画面から確認できます。
