# CLI Reference

Pass `--name` (or `-n`) to enter non-interactive mode. All other prompts are driven by flags.

```bash
pnpm create-app --help   # show usage
```

---

## Scaffold Type Inference

The scaffold type is inferred from the combination of flags you provide:

| Scaffold type | Required flags |
|---------------|----------------|
| **Full-stack** | `--storage-type` + `--ui` |
| **DS only** | `--storage-type` (no `--ui`) |
| **UI only** | `--ui` + `--sdk` (no `--storage-type`) |

---

## Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--name` | `-n` | **required** | Project name (lowercase, hyphens allowed) |
| `--scope` | `-s` | **required** | Org scope without `@` (e.g. `myorg`) |
| `--output` | `-o` | `./<name>` | Output directory |
| `--storage-type` | — | _(none)_ | `relational \| document \| filebased` |
| `--orm` | — | `prisma` | `prisma \| drizzle` _(relational only)_ |
| `--db` | — | `postgresql` | `postgresql \| mysql \| sqlite \| cockroachdb` _(relational only)_ |
| `--document-provider` | — | `couchbase` | `couchbase \| mongodb \| documentdb` _(document only)_ |
| `--document-impl` | — | `standard` | `standard \| hprt` _(mongodb/documentdb only)_ |
| `--ui` | — | _(none)_ | `standard \| hprt` |
| `--sdk` | — | — | External SDK package _(required for UI only mode)_ |
| `--no-env` | — | — | Skip `.env` generation |
| `--no-git` | — | — | Skip `git init` |
| `--yes` | `-y` | — | Accept all defaults (still requires `--name` and `--scope`) |
| `--help` | `-h` | — | Show usage |

---

## Examples

```bash
# Full-stack — Relational, Drizzle, PostgreSQL, HPRT UI
pnpm create-app --name my-app --scope myorg \
  --storage-type relational --orm drizzle --db postgresql --ui hprt

# Full-stack — Relational, Prisma, MySQL, standard UI
pnpm create-app --name my-app --scope myorg \
  --storage-type relational --orm prisma --db mysql --ui standard

# Full-stack — Document DB, MongoDB, native SDK, standard UI
pnpm create-app --name my-app --scope myorg \
  --storage-type document --document-provider mongodb --document-impl hprt --ui standard

# Full-stack — File-based storage, HPRT UI
pnpm create-app --name my-app --scope myorg \
  --storage-type filebased --ui hprt

# DS only — Drizzle + SQLite
pnpm create-app --name my-api --scope myorg \
  --storage-type relational --orm drizzle --db sqlite

# DS only — Couchbase
pnpm create-app --name my-api --scope myorg \
  --storage-type document --document-provider couchbase

# UI only — standalone Next.js with external published SDK
pnpm create-app --name my-ui --scope myorg \
  --ui standard --sdk @acme/ds-sdk
```

---

## Related

- [Storage / UI Matrix](04-storage-ui-matrix.md) — which DS and UI variants are compatible
- [Post-Scaffold Setup](05-post-scaffold-setup.md) — what to do once the scaffold is written
