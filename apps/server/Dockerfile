# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/pnpm-lock.yaml apps/server/
COPY packages/code-export/package.json packages/code-export/
COPY packages/component-generator/package.json packages/component-generator/pnpm-lock.yaml packages/component-generator/
COPY packages/forge-core/package.json packages/forge-core/
COPY packages/project-generator/package.json packages/project-generator/
COPY packages/vendor/package.json packages/vendor/pnpm-lock.yaml packages/vendor/

RUN pnpm i

FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm -r run build
RUN pnpm --filter @frontend-forge/server deploy /app/server

FROM node:22-alpine AS runner
WORKDIR /app/server
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /app/server ./

ENV CACHE_DIR=/data/cache
RUN mkdir -p /data/cache && chown -R app:app /data

USER app
EXPOSE 3000

CMD ["node", "dist/server.js"]
