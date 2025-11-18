FROM node:20-alpine AS dev

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

ENV PATH=/node_modules/.bin:$PATH

EXPOSE 4000
CMD ["yarn", "dev", "--host", "0.0.0.0"]