# Post-Scaffold Setup

After `pnpm create-app` finishes writing your project:

```bash
cd <outputDir>
pnpm install
```

---

## 1. Configure environment files

Each package has a `.env` file (generated from `.env.example` unless you passed `--no-env`). Open each one and fill in your credentials.

See [Environment Variables](../admin/01-environment-variables.md) for a full reference of every variable per package.

---

## 2. Run codegen _(full-stack / DS only)_

Generate the TypedDocumentNode SDK from your GraphQL schema:

```bash
pnpm codegen
```

This runs `graphql-codegen` against the DS package and writes types into `packages/ds-sdk`. Turbo runs this automatically before every build, but run it manually the first time so your UI picks up the types.

---

## 3. Start the dev server

```bash
pnpm dev        # start all packages concurrently
```

Or start individual packages:

```bash
pnpm --filter @<scope>/ds dev    # DS only
pnpm --filter @<scope>/ui dev    # UI only
```

---

## 4. Build for production

```bash
pnpm build      # runs codegen → build for all packages
```

---

## Useful Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all packages in development mode |
| `pnpm build` | Build all packages (codegen runs first) |
| `pnpm codegen` | Regenerate TypedDocumentNode SDK |

---

## Next Steps

- [Environment Variables](../admin/01-environment-variables.md) — full variable reference
- [Docker Deployment](../admin/02-docker-deployment.md) — containerising your project
- [PubSub / Redis](../admin/03-pubsub-redis.md) — enabling Redis for production subscriptions
