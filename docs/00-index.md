# coding-templates Documentation Index

Welcome to the coding-templates documentation! This monorepo provides production-ready templates for full-stack GraphQL applications with Next.js frontends and GraphQL Yoga backends.

---

## 📚 Documentation by Category

### Admin & Operations

- [Environment Variables](admin/01-environment-variables.md) — full env var reference for every package
- [Docker Deployment](admin/02-docker-deployment.md) — Dockerfile usage, build commands, runtime config
- [PubSub / Redis](admin/03-pubsub-redis.md) — transport selection and Redis configuration

### Architecture

- [System Overview](architecture/01-system-overview.md) — component topology, routing, SDK pipeline
- [Monorepo Design](architecture/02-monorepo-design.md) — workspace layout, design decisions, CalVer versioning
- [Data Service Design](architecture/03-data-service-design.md) — DS variants, storage selection rationale
- [UI Package Design](architecture/04-ui-package-design.md) — shared UI package scope and design decisions
- [Technology Decisions](architecture/05-technology-decisions.md) — ADR table for all technology choices
- [Package Dependencies](architecture/06-package-dependencies.md) — version reference and upgrade log

### Developer Guides

- [Monorepo Overview](developer/01-monorepo-overview.md) — repo layout, package reference, root scripts
- [GraphQL Schema](developer/02-graphql-schema.md) — SDL layout, docstring rules, entity patterns
- [Repository Pattern](developer/03-repository-pattern.md) — IRepository interface, adding new entities
- [PubSub Internals](developer/04-pubsub-internals.md) — factory pattern, topic wiring, resolver integration
- [UI Architecture](developer/05-ui-architecture.md) — UI template state and app-level config
- [UI Status Dashboard](developer/06-ui-status.md) — living capability matrix across all UI packages
- [Git Conventions](developer/07-git-conventions.md) — Conventional Commits format and examples
- [Coding Guidelines](developer/08-coding-guidelines.md) — code style, component patterns, review checklist
- [Enhancement Backlog](developer/09-enhancement-backlog.md) — future improvements for UI and DS packages

### User Guides (create-app)

- [Introduction](user/01-introduction.md) — what gets scaffolded, scaffold shapes
- [Interactive Mode](user/02-interactive-mode.md) — guided prompt walkthrough
- [CLI Reference](user/03-cli-reference.md) — non-interactive flags for CI and scripting
- [Storage / UI Matrix](user/04-storage-ui-matrix.md) — DS and UI variant compatibility
- [Post-Scaffold Setup](user/05-post-scaffold-setup.md) — env files, codegen, first run

---

## 🔍 Quick Reference

### Common Tasks

| Task                        | Documentation                                                 |
| --------------------------- | ------------------------------------------------------------- |
| **Set up a new project**    | [Interactive Mode](user/02-interactive-mode.md)               |
| **Configure environment**   | [Environment Variables](admin/01-environment-variables.md)    |
| **Deploy with Docker**      | [Docker Deployment](admin/02-docker-deployment.md)            |
| **Add a GraphQL entity**    | [Repository Pattern](developer/03-repository-pattern.md)      |
| **Add a subscription**      | [PubSub Internals](developer/04-pubsub-internals.md)          |
| **Choose a DS variant**     | [Data Service Design](architecture/03-data-service-design.md) |
| **Write a commit message**  | [Git Conventions](developer/07-git-conventions.md)            |
| **Check UI package status** | [UI Status Dashboard](developer/06-ui-status.md)              |

---

## 📖 Documentation by Audience

### For Developers

1. [Monorepo Overview](developer/01-monorepo-overview.md) — understand the repo layout and scripts
2. [Coding Guidelines](developer/08-coding-guidelines.md) — code style and component patterns
3. [GraphQL Schema](developer/02-graphql-schema.md) — how to define and extend the schema
4. [Repository Pattern](developer/03-repository-pattern.md) — how resolvers interact with databases
5. [Git Conventions](developer/07-git-conventions.md) — commit message format

### For Operations

1. [System Overview](architecture/01-system-overview.md) — component topology and data flow
2. [Environment Variables](admin/01-environment-variables.md) — required configuration per package
3. [Docker Deployment](admin/02-docker-deployment.md) — building and running containers
4. [PubSub / Redis](admin/03-pubsub-redis.md) — transport selection for production

### For New Users

1. [Introduction](user/01-introduction.md) — what create-app scaffolds
2. [Interactive Mode](user/02-interactive-mode.md) — step-by-step project creation
3. [Post-Scaffold Setup](user/05-post-scaffold-setup.md) — getting your project running

---

## 🗂️ Complete File Listing

| File                                                                               | Description                   |
| ---------------------------------------------------------------------------------- | ----------------------------- |
| [00-index.md](00-index.md)                                                         | This navigation index         |
| [10-contributing.md](10-contributing.md)                                           | Contributing guidelines       |
| [admin/01-environment-variables.md](admin/01-environment-variables.md)             | Env var reference per package |
| [admin/02-docker-deployment.md](admin/02-docker-deployment.md)                     | Docker build and deploy       |
| [admin/03-pubsub-redis.md](admin/03-pubsub-redis.md)                               | Redis transport config        |
| [architecture/01-system-overview.md](architecture/01-system-overview.md)           | Component topology            |
| [architecture/02-monorepo-design.md](architecture/02-monorepo-design.md)           | Workspace design              |
| [architecture/03-data-service-design.md](architecture/03-data-service-design.md)   | DS variant rationale          |
| [architecture/04-ui-package-design.md](architecture/04-ui-package-design.md)       | UI package design             |
| [architecture/05-technology-decisions.md](architecture/05-technology-decisions.md) | Technology ADRs               |
| [architecture/06-package-dependencies.md](architecture/06-package-dependencies.md) | Dependency versions           |
| [developer/01-monorepo-overview.md](developer/01-monorepo-overview.md)             | Repo layout and scripts       |
| [developer/02-graphql-schema.md](developer/02-graphql-schema.md)                   | SDL conventions               |
| [developer/03-repository-pattern.md](developer/03-repository-pattern.md)           | Repository interface          |
| [developer/04-pubsub-internals.md](developer/04-pubsub-internals.md)               | PubSub wiring                 |
| [developer/05-ui-architecture.md](developer/05-ui-architecture.md)                 | UI template state             |
| [developer/06-ui-status.md](developer/06-ui-status.md)                             | Capability matrix             |
| [developer/07-git-conventions.md](developer/07-git-conventions.md)                 | Commit format                 |
| [developer/08-coding-guidelines.md](developer/08-coding-guidelines.md)             | Code style guide              |
| [developer/09-enhancement-backlog.md](developer/09-enhancement-backlog.md)         | Future improvements           |

---

## 🔗 External Resources

- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) — DS server framework
- [Next.js](https://nextjs.org/docs) — UI application framework
- [Turborepo](https://turbo.build/repo/docs) — monorepo build orchestration
- [pnpm](https://pnpm.io/) — package manager
- [shadcn/ui](https://ui.shadcn.com/) — UI component primitives

---

**Related**: [CLAUDE.md](../CLAUDE.md) | [Contributing](10-contributing.md)

**Last updated**: March 31, 2026
