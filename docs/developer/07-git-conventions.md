# Git Conventions

---

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[(<component>)]: <description>

[optional body]

[optional footer]
```

The `(<component>)` section is optional.

### Types

| Type | Use for |
|------|---------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code restructuring without changing behaviour |
| `docs:` | Documentation changes |
| `style:` | Code style changes (formatting, etc.) |
| `test:` | Adding or updating tests |
| `chore:` | Maintenance tasks |

### Examples

```
refactor: Extract header components into reusable modules

- Created SystemInfo component for metadata display
- Split Legend into separate component
- Reduced page.tsx size by 45%

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```
refactor(ui): Extract header components into reusable modules

- Created SystemInfo component for metadata display
- Split Legend into separate component
- Reduced page.tsx size by 45%

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

For technology choice guidance (state management, GraphQL tooling), see [Technology Decisions](../architecture/05-technology-decisions.md).

---

**Related**: [Coding Guidelines](08-coding-guidelines.md) | [Contributing](../10-contributing.md)

**Last updated**: March 31, 2026
