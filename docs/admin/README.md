# Admin & Operations Documentation

Deployment, configuration, and infrastructure guides for the coding-templates monorepo. These documents cover environment setup, Docker containerization, and production transport configuration.

---

## Contents

| Document | Description |
|----------|-------------|
| [01-environment-variables.md](01-environment-variables.md) | Full env var reference for DS, UI, and auth packages |
| [02-docker-deployment.md](02-docker-deployment.md) | Dockerfile usage, build commands, standalone output config |
| [03-pubsub-redis.md](03-pubsub-redis.md) | Redis vs in-memory transport selection and configuration |

---

## Design Principles

- **All ports from env, no defaults** — prevents port collision surprises across packages
- **Docker build context is always the monorepo root** — required for `pnpm-lock.yaml` and workspace manifests
- **Redis is opt-in** — in-memory transport works out of the box; Redis activates when `REDIS_URL` is set

---

**Related**: [Documentation Index](../00-index.md) | [Developer Guides](../developer/README.md)

**Last updated**: March 31, 2026
