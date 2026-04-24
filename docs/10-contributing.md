# Contributing & Support

---

## Contributing

### Getting Started

1. Clone the repository and run `pnpm install` from the root
2. Copy `.env.example` to `.env` in each package you plan to develop
3. Run `pnpm dev` to start all packages in development mode
4. See [Monorepo Overview](developer/01-monorepo-overview.md) for the full workspace layout and available scripts

### Pull Request Guidelines

1. **Test changes locally** before submitting a PR — run `pnpm build` to verify the full pipeline
2. **Update documentation** for any configuration, env var, architecture, or behavioral changes
3. **Follow commit conventions** — see [Git Conventions](developer/07-git-conventions.md) for the Conventional Commits format
4. **Follow coding standards** — see [Coding Guidelines](developer/08-coding-guidelines.md) for component patterns and review checklist
5. **Update [Index](00-index.md)** if adding new documents
6. **Keep PRs focused** — one logical change per PR

### Documentation Standards

- All `README.md` files use proper capitalization
- Doc files use 2-digit prefix + kebab-case: `01-quickstart.md`
- Include working examples for all procedures
- Document the **why**, not just the what
- Add troubleshooting sections where applicable
- Link to related documentation
- End every file with a `**Related**:` line and `**Last updated**:` timestamp

### File Naming Conventions

| Type                   | Convention                 | Example                     |
| ---------------------- | -------------------------- | --------------------------- |
| Index files            | `00-index.md`              | `docs/00-index.md`          |
| Content docs           | `NN-kebab-case.md` (01–08) | `01-quickstart.md`          |
| Future / roadmap       | `09-*.md`                  | `09-enhancement-backlog.md` |
| Contributing guide     | `10-contributing.md`       | `docs/10-contributing.md`   |
| Subdirectory overviews | `README.md` (capitalized)  | `admin/README.md`           |

### Code Quality

- No placeholders or pseudocode — all code must be production-ready
- No TODO comments in committed code
- Every feature plan must include a docs update step
- Shared UI packages must declare `"sideEffects": false` for tree-shaking

---

## Support & Feedback

For issues, questions, or suggestions:

1. **Check the docs first** — [Documentation Index](00-index.md)
2. **Open a GitHub issue** with:
   - What you were trying to do
   - What happened instead
   - Relevant logs and error messages
   - Steps to reproduce

---

**Related**: [Documentation Index](00-index.md) | [Coding Guidelines](developer/08-coding-guidelines.md) | [Git Conventions](developer/07-git-conventions.md)

**Last updated**: March 31, 2026
