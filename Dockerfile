FROM oven/bun:1 AS deps
WORKDIR /app
# better-sqlite3 is a native module and needs a toolchain to build from source
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Runtime deliberately uses Node, not Bun — Bun's N-API bridge has a known
# fatal crash (`panic: NAPI FATAL ERROR: Error::New napi_get_last_error_info`)
# when better-sqlite3's native binding is touched under load. Bun stays fine
# for install/build above since those never open the database.
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/middleware.ts ./middleware.ts

# data/ (SQLite db + uploads) is mounted as a volume, not baked into the image
RUN mkdir -p /app/data/uploads

EXPOSE 3000

CMD ["node", "node_modules/.bin/next", "start"]
