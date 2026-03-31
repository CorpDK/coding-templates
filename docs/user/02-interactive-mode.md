# Interactive Mode

Run `pnpm create-app` with no flags to enter the guided prompt flow.

```bash
pnpm create-app
```

You will be walked through the following steps in order:

---

## Step-by-Step Prompts

### 1. Project name

Lowercase letters, numbers, and hyphens; must start with a letter.

Example: `my-app`

---

### 2. Org scope

Your npm organisation scope without the `@`.

Example: `myorg` (produces `@myorg/` scoped packages)

---

### 3. Scaffold shape

Choose the project shape:

| Option | Description |
|--------|-------------|
| `Full-stack` | UI + DS (GraphQL Yoga + chosen storage) |
| `DS only` | GraphQL Yoga backend only |
| `UI only` | Next.js frontend connecting to an external DS |

---

### 4. Output directory

Where to write the scaffolded project. Defaults to `./<name>`.

---

### 5. Storage type _(Full-stack / DS only)_

Top-level backend category:

| Option | Description |
|--------|-------------|
| `relational` | SQL databases via Prisma or Drizzle ORM |
| `document` | NoSQL: Couchbase, MongoDB, or DocumentDB |
| `filebased` | JSON/YAML file storage, zero external dependencies |

---

### 6. ORM _(relational only)_

| Option | Description |
|--------|-------------|
| `prisma` | Prisma ORM — supports PostgreSQL, MySQL, SQLite, CockroachDB |
| `drizzle` | Drizzle ORM — supports the same databases, optimised for high-performance real-time |

---

### 7. Document DB provider _(document only)_

| Option | Description |
|--------|-------------|
| `couchbase` | Couchbase Capella or self-hosted |
| `mongodb` | MongoDB Atlas or self-hosted |
| `documentdb` | DocumentDB (documentdb.io) — MongoDB-compatible wire protocol |

---

### 8. Implementation _(MongoDB / DocumentDB only)_

| Option | Description |
|--------|-------------|
| `standard` | Prisma ORM |
| `hprt` | Native SDK — no ORM overhead, higher throughput |

---

### 9. Database _(relational only)_

`postgresql` (default) · `mysql` · `sqlite` · `cockroachdb`

---

### 10. UI variant _(Full-stack / UI only)_

| Option | Description |
|--------|-------------|
| `standard` | Apollo Client — best for standard CRUD UIs |
| `hprt` | urql + Graphcache — best for high-frequency real-time data |

In Full-stack mode, only the variants compatible with your chosen DS are shown. See the [Storage / UI Matrix](04-storage-ui-matrix.md).

---

### 11. Optional UI packages _(Full-stack / UI only)_

A multiselect prompt where you toggle optional shared packages (space to toggle, enter to confirm):

| Package | Description |
|---------|-------------|
| `ui-forms` | React Hook Form + Zod |
| `ui-datagrid` | TanStack Table + virtualization |
| `ui-charts` | D3.js charts |
| `ui-auth` | Auth UI components + BFF OAuth2/OIDC scaffold |

> `ui-core` and `ui-feedback` are always included automatically when any UI is selected.

---

### 12. External SDK _(UI only)_

The published `@scope/ds-sdk` package your UI will consume.

Must be a valid scoped package name, e.g. `@acme/ds-sdk`.

---

### 13. Generate `.env` files

Copies `.env.example` → `.env` in each scaffolded package. Defaults to **yes**.

---

### 14. Init git repository

Runs `git init` and creates an initial commit. Defaults to **yes**.

---

## After the Prompts

Once confirmed, the scaffold writes your project to the output directory. See [Post-Scaffold Setup](05-post-scaffold-setup.md) for next steps.

---

**Related**: [CLI Reference](03-cli-reference.md) | [Storage / UI Matrix](04-storage-ui-matrix.md) | [Post-Scaffold Setup](05-post-scaffold-setup.md)

**Last updated**: March 31, 2026
