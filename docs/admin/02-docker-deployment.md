# Docker Deployment

Every scaffolded project includes production-ready Dockerfiles co-located with each package.

---

## Build Commands

All monorepo Dockerfiles use the **repo root as the build context** because they need `pnpm-lock.yaml` and the workspace manifests.

| Scaffold type | Dockerfile location | Build command |
|---------------|--------------------|----|
| DS (monorepo) | `packages/<ds>/Dockerfile` | `docker build -f packages/ds/Dockerfile -t my-app-ds .` |
| UI (monorepo) | `packages/<ui>/Dockerfile` | `docker build -f packages/ui/Dockerfile -t my-app-ui .` |

---

## UI Dockerfile — Standalone Output Requirement

The UI Dockerfile uses Next.js [standalone output](https://nextjs.org/docs/app/api-reference/next-config-js/output), which bundles the Next.js server into a single `server.js` file (no `next` CLI needed at runtime).

You must have `output: 'standalone'` set in the UI package's `next.config.ts` before building the image:

```typescript
// packages/ui/next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
  // ...
};
```

---

## DS Dockerfile Notes

- Build context is always the monorepo root
- `@corpdk/ds-sdk` is resolved at build time; Docker's `COPY` dereferences pnpm symlinks so it is self-contained in `node_modules` at runtime
- SDL schema files (`src/schema/*.graphqls`) are copied to `dist/` by the DS build script — no extra step needed

---

## Environment Variables at Runtime

Pass env vars to your containers at runtime (not baked into the image):

```bash
docker run --env-file .env -p 4000:4000 my-app-ds
docker run --env-file .env -p 3000:3000 my-app-ui
```

Or use Docker Compose with an `env_file` directive. See [Environment Variables](01-environment-variables.md) for the full reference.

---

## Template Dockerfiles (this repo)

The template Dockerfiles are stored in `templates/docker/` and are copied into scaffolded projects:

| File | Usage |
|------|-------|
| `Dockerfile.ui` | UI variant (copied to `packages/<ui>/Dockerfile`) |
| `Dockerfile.ds` | DS variant (copied to `packages/<ds>/Dockerfile`) |

---

**Related**: [Environment Variables](01-environment-variables.md) | [Post-Scaffold Setup](../user/05-post-scaffold-setup.md)

**Last updated**: March 31, 2026
