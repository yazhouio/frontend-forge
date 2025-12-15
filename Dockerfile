# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./

RUN if [ -f package-lock.json ]; then npm ci; else npm i; fi

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./package.json
COPY src ./src

ENV CACHE_DIR=/data/cache
RUN mkdir -p /data/cache && chown -R app:app /data

USER app
EXPOSE 3000

CMD ["node", "src/server.mjs"]
