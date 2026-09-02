FROM oven/bun:1 AS deps
WORKDIR /app
# --ignore-scripts: Bun's bundled node-gyp targets Node headers far newer
# than what better-sqlite3's source supports (removed V8 APIs), so letting
# Bun run its install/build script here fails outright. The real compile
# happens in the runner stage below, against the actual Node runtime.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

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

# better-sqlite3 was installed with --ignore-scripts above (Bun's build
# skipped entirely), so this is the first and only real compile — against
# this exact Node runtime's actual headers/ABI.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
RUN npm rebuild better-sqlite3

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/middleware.ts ./middleware.ts

# data/ (SQLite db + uploads) is mounted as a volume, not baked into the image
RUN mkdir -p /app/data/uploads

EXPOSE 3000

CMD ["node", "node_modules/.bin/next", "start"]
