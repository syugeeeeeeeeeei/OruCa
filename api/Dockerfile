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
# TypeScriptをビルド (distディレクトリに出力される設定を想定)
# package.jsonにbuildスクリプトがない場合、npx tscを直接実行
RUN npx tsc

# --- Production Stage (本番実行用) ---
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

COPY package.json yarn.lock ./
# 本番用依存関係のみインストール
RUN yarn install --production --frozen-lockfile

# Builderステージからビルド成果物(dist)と必要なファイルをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config.ts ./dist/config.js 
# ※config.tsの扱いによるが、tscでjsになっているはず。構成に合わせて調整

EXPOSE 3000
# コンパイル済みのJSを実行
CMD ["node", "dist/server.js"]