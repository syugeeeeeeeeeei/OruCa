# --- Base Stage ---
FROM node:20-alpine AS base
WORKDIR /app
# パッケージ定義をコピー
COPY package.json yarn.lock ./
# 共通設定やtsconfigをコピー
COPY tsconfig.json ./

# --- Development Stage (ローカル開発用) ---
FROM base AS dev
# 開発用依存関係も含めてインストール
RUN yarn install --frozen-lockfile
# ソースコードはバインドマウントされるため、ここではCOPYしない
ENV PATH=/app/node_modules/.bin:$PATH
CMD ["yarn", "start"]

# --- Builder Stage (本番ビルド用) ---
FROM base AS builder
RUN yarn install --frozen-lockfile
# ソースコードをコピーしてビルド
COPY . .

# 1. TypeScriptをビルド (distディレクトリに出力)
RUN npx tsc --outDir ./dist

# 2. パスエイリアス (@src/...) を相対パスに置換するツールを導入・実行
RUN npm install -g tsc-alias
RUN npx tsc-alias -p tsconfig.json --outDir ./dist

# --- Production Stage (本番実行用) ---
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

COPY package.json yarn.lock ./
# 本番用依存関係のみインストール
RUN yarn install --production --frozen-lockfile

# Builderステージからビルド成果物(dist)のみをコピー
COPY --from=builder /app/dist ./dist

# 必要であれば環境変数設定など
EXPOSE 3000

# コンパイル済みのJSを実行 (パス解決済みなのでnodeコマンドで動作します)
CMD ["node", "dist/server.js"]