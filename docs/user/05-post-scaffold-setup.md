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

Generate the TypedDocumentNode SDK and CLI from your GraphQL schema:

```bash
pnpm codegen
```

This runs `graphql-codegen` against the DS package and writes into two places:
- `packages/ds-sdk/src/generated/` — TypedDocumentNode types for the UI
- `packages/ds-cli/src/generated/` — executable CLI + man page + GNU info page

Turbo runs this automatically before every build, but run it manually the first time so your UI picks up the types.

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

## Using the CLI _(full-stack / DS only)_

After codegen, the project CLI is available at `packages/ds-cli/src/generated/index.js`. Set the environment variables and run:

```bash
export DS_HTTP_URL=http://localhost:<ds-port>/graphql
export DS_WS_URL=ws://localhost:<ds-port>/graphql

node packages/ds-cli/src/generated/index.js --help
```

Or install it globally / link it via pnpm so the binary (`<projectName>`) is on your PATH.

**Examples:**

```bash
# Query
my-app items

# Mutation (explicit flags)
my-app create-item --name "Widget" --description "A round widget"

# Mutation (variables from JSON file)
my-app create-item --input vars.json

# Mutation (piped JSON)
echo '{"name":"Widget"}' | my-app create-item

# Subscription — stream 3 events then exit
my-app item-created --count 3

# Subscription — stream for 5 seconds
my-app item-created --timeout 5000
```

All output is newline-delimited JSON (NDJSON) on stdout. Errors go to stderr with a non-zero exit code.

Man page: `man ./packages/ds-cli/src/generated/man/<projectName>.1`

---

## Useful Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all packages in development mode |
| `pnpm build` | Build all packages (codegen runs first) |
| `pnpm codegen` | Regenerate TypedDocumentNode SDK and CLI |

---

**Related**: [Environment Variables](../admin/01-environment-variables.md) | [Docker Deployment](../admin/02-docker-deployment.md) | [PubSub / Redis](../admin/03-pubsub-redis.md)

**Last updated**: March 31, 2026
