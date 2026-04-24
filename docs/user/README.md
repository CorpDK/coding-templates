# User Guides

End-user documentation for the `@corpdk/create-app` scaffolding tool. These guides walk you through creating a new full-stack, DS-only, or UI-only project from the coding-templates monorepo.

---

## Contents

| Document                                               | Description                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| [01-introduction.md](01-introduction.md)               | What gets scaffolded, scaffold shapes (full-stack, DS-only, UI-only) |
| [02-interactive-mode.md](02-interactive-mode.md)       | Step-by-step guided prompt walkthrough                               |
| [03-cli-reference.md](03-cli-reference.md)             | Non-interactive flags for CI and scripting                           |
| [04-storage-ui-matrix.md](04-storage-ui-matrix.md)     | DS and UI variant compatibility matrix                               |
| [05-post-scaffold-setup.md](05-post-scaffold-setup.md) | Env files, codegen, first run, and next steps                        |

---

## Design Principles

- **Interactive by default** — running `pnpm create-app` without flags launches a guided prompt sequence
- **CI-friendly** — all prompts can be bypassed with command-line flags for automated scaffolding
- **Shape inference** — the CLI infers scaffold shape (full-stack, DS-only, UI-only) from the flags you provide

---

**Related**: [Documentation Index](../00-index.md) | [Admin Guides](../admin/README.md) | [Developer Guides](../developer/README.md)

**Last updated**: March 31, 2026
