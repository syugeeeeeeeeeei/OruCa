FROM node:20-alpine AS dev

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

# Compose Watchの初期同期元としてイメージにもソースを含める
COPY . .

ENV PATH=/node_modules/.bin:$PATH

EXPOSE 4000
CMD ["yarn", "dev", "--host", "0.0.0.0"]
