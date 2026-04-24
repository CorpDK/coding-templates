# Architecture Documentation

System design, technology decisions, and architectural rationale for the coding-templates monorepo. These documents explain the "why" behind structural choices — from the monorepo layout to individual package boundaries.

---

## Contents

| Document                                                 | Description                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| [01-system-overview.md](01-system-overview.md)           | Component topology, routing model, SDK pipeline                  |
| [02-monorepo-design.md](02-monorepo-design.md)           | Workspace layout, directory roles, CalVer versioning             |
| [03-data-service-design.md](03-data-service-design.md)   | DS variant rationale, Repository Pattern, codegen strategy       |
| [04-ui-package-design.md](04-ui-package-design.md)       | Six shared UI packages — scope, technology, and design decisions |
| [05-technology-decisions.md](05-technology-decisions.md) | ADR table for UI layer, state management, and GraphQL tooling    |
| [06-package-dependencies.md](06-package-dependencies.md) | Version pinning policy, CalVer format, dependency upgrade log    |

---

## Design Principles

- **Convention over configuration** — sensible defaults across all templates; apps override only what they need
- **Separation by concern** — UI packages split by responsibility (core, forms, charts, datagrid, feedback, auth), not by feature
- **Schema-identical DS variants** — all backend variants produce the same GraphQL SDL, enabling a single shared SDK
- **Repository Pattern everywhere** — resolvers never touch DB-specific APIs; all data access goes through `IItemRepository`

---

**Related**: [Documentation Index](../00-index.md) | [Developer Guides](../developer/README.md) | [Admin Guides](../admin/README.md)

**Last updated**: March 31, 2026
