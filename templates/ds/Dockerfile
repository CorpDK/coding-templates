# syntax=docker/dockerfile:1
# Build from the monorepo root: docker build -f templates/ds/Dockerfile .

# ── Base ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.node.json ./
COPY templates/ds/package.json ./templates/ds/package.json
COPY templates/ds-sdk/package.json ./templates/ds-sdk/package.json
COPY templates/ds-cli/package.json ./templates/ds-cli/package.json
COPY libraries/dal-core/package.json ./libraries/dal-core/package.json
COPY libraries/dal-codegen/package.json ./libraries/dal-codegen/package.json
COPY libraries/pub-sub/package.json ./libraries/pub-sub/package.json
COPY libraries/codegen-cli/package.json ./libraries/codegen-cli/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY libraries/dal-core ./libraries/dal-core
COPY libraries/dal-codegen ./libraries/dal-codegen
COPY libraries/pub-sub ./libraries/pub-sub
COPY libraries/codegen-cli ./libraries/codegen-cli
COPY templates/ds-sdk ./templates/ds-sdk
COPY templates/ds-cli ./templates/ds-cli
COPY templates/ds ./templates/ds

RUN pnpm --filter @corpdk/dal-core build && \
    pnpm --filter @corpdk/dal-codegen build && \
    pnpm --filter @corpdk/pub-sub build && \
    pnpm --filter @corpdk/codegen-cli build && \
    pnpm --filter @corpdk/ds dal:codegen && \
    pnpm --filter @corpdk/ds codegen && \
    pnpm --filter @corpdk/ds-sdk build && \
    pnpm --filter @corpdk/ds build && \
    pnpm --filter @corpdk/ds db:generate

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/libraries/dal-core /app/libraries/dal-core
COPY --from=build /app/libraries/pub-sub /app/libraries/pub-sub
COPY --from=build /app/templates/ds/package.json /app/templates/ds/package.json
COPY --from=build /app/templates/ds/dist /app/templates/ds/dist
COPY --from=build /app/templates/ds/node_modules /app/templates/ds/node_modules
COPY --from=build /app/templates/ds/drizzle.config.ts /app/templates/ds/drizzle.config.ts
COPY --from=build /app/templates/ds/drizzle /app/templates/ds/drizzle
COPY --from=build /app/templates/ds/src/db/schema /app/templates/ds/src/db/schema
COPY templates/ds/docker-entrypoint.sh /app/templates/ds/docker-entrypoint.sh
RUN chmod +x /app/templates/ds/docker-entrypoint.sh

WORKDIR /app/templates/ds
USER node
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
