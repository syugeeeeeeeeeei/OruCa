# --- Builder Stage (フロントエンドのビルド) ---
FROM node:20-alpine AS builder
WORKDIR /app

# ビルドコンテキストはルート(.)になるため、viteディレクトリを指定してコピー
COPY vite/package.json vite/yarn.lock ./
RUN yarn install --frozen-lockfile

# ソースコードをコピー
COPY vite/ .
# ビルド実行 (distディレクトリが生成される)
RUN yarn build

# --- Production Stage (Nginxでの配信) ---
FROM nginx:latest AS prod

# カスタムnginx設定をコピー (ビルドコンテキストはルート)
COPY web/default.conf /etc/nginx/conf.d/default.conf

# ビルド成果物をNginxのドキュメントルートにコピー
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80