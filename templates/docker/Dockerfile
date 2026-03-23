# syntax=docker/dockerfile:1
# Requires output: 'standalone' in next.config.ts
# Build from the project root: docker build -t <image> .

# ── Base ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY --exclude=.env --exclude=.env.local --exclude=.env.*.local . .

# Public env vars must be available at build time
ARG NEXT_PUBLIC_DS_URL
ARG NEXT_PUBLIC_DS_WS_URL
ENV NEXT_PUBLIC_DS_URL=$NEXT_PUBLIC_DS_URL
ENV NEXT_PUBLIC_DS_WS_URL=$NEXT_PUBLIC_DS_WS_URL

RUN pnpm build

# ── Runtime ───────────────────────────────────────────────────────────────────
# Next.js standalone output bundles the server — no pnpm or next CLI needed.
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
