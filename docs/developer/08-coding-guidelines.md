# Coding Guidelines

Coding standards and best practices for all packages in this repository.

---

## Core Principles

### 1. Pure Components

- **Single Responsibility**: Each component should have one clear purpose
- **No Side Effects**: Pure components should not modify external state during rendering
- **Predictable**: Same props should always produce the same output
- **Testable**: Components should be easy to test in isolation

### 2. Code Reusability

- Extract duplicated code into shared utilities or components
- Create generic components that can be reused across different views
- Use composition over inheritance

### 3. Type Safety

- Always define TypeScript interfaces for props
- Use strict typing — avoid `any`
- Define shared types in centralized location (`types/` directory)
- Export and reuse type definitions across files

---

## Project Structure

### Directory Organization

```
├── app/                     # Next.js App Router pages
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main page (orchestration only)
├── components/              # React components
│   └── ui/                  # Reusable UI primitives
│       ├── LoadingState.tsx
│       ├── ErrorState.tsx
│       ├── EmptyState.tsx
│       ├── SearchInput.tsx
│       └── FilterButton.tsx
├── lib/                     # Utility functions
│   ├── utils.ts             # Shared utilities (cn, fuzzyMatch, formatTimestamp)
│   ├── search.ts            # Fuzzy search
│   ├── formatting.ts        # Date/string formatting
│   └── constants.ts         # App-wide constants
├── types/                   # TypeScript type definitions
│   └── index.ts             # Shared type definitions
└── public/                  # Static assets
```

### Component Organization Rules

1. **Page Components** (`app/page.tsx`):
   - Orchestrate data fetching and state management
   - Compose other components
   - Should be lightweight (< 100 lines)

2. **View Components** (`components/DependencyGraph.tsx`, etc.):
   - Handle view-specific logic
   - Delegate UI rendering to subcomponents
   - Maximum 250 lines (if longer, split into subcomponents)

3. **UI Components** (`components/ui/`):
   - Pure, reusable UI primitives
   - No business logic
   - Generic and configurable via props
   - Maximum 50 lines per component

4. **Subcomponents** (`components/<feature>/`):
   - Specific to their parent view
   - Pure and focused
   - Maximum 100 lines

---

## Code Style

### Component Structure

```typescript
// 1. Imports (grouped: external, internal, types)
import { useState, useMemo } from "react";
import { IdentifiableItem } from "@/types/index";
import { fuzzyMatch } from "@/lib/utils";
import LoadingState from "@/components/ui/LoadingState";

// 2. Type definitions (if component-specific)
interface MyComponentProps {
  data: string[];
  onSelect: (item: string) => void;
}

// 3. Helper components (if pure and small)
function HelperComponent({ value }: { value: string }) {
  return <span>{value}</span>;
}

// 4. Main component
export default function MyComponent({ data, onSelect }: MyComponentProps) {
  // State hooks
  const [selected, setSelected] = useState<string | null>(null);

  // Computed values (useMemo for expensive operations)
  const filtered = useMemo(() => {
    return data.filter(item => item.length > 0);
  }, [data]);

  // Event handlers
  const handleClick = (item: string) => {
    setSelected(item);
    onSelect(item);
  };

  // Early returns for loading/error states
  if (data.length === 0) {
    return <EmptyState message="No data" />;
  }

  // Main render
  return (
    <div>
      {filtered.map(item => (
        <button key={item} onClick={() => handleClick(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}
```

### Naming Conventions

1. **Components**: PascalCase (`MyComponent`, `SearchInput`)
2. **Functions**: camelCase (`handleClick`, `fetchData`)
3. **Constants**: UPPER_SNAKE_CASE for true constants, camelCase for configuration objects
4. **Files**:
   - Component files: PascalCase matching component name (`MyComponent.tsx`)
   - Utility files: camelCase (`utils.ts`)
   - Type files: camelCase (`package.ts`)

### Props Guidelines

1. **Interface naming**: `ComponentNameProps`

   ```typescript
   interface SearchInputProps {
     value: string;
     onChange: (value: string) => void;
   }
   ```

2. **Destructure props** in function signature

   ```typescript
   // Good
   function SearchInput({ value, onChange }: SearchInputProps) {}

   // Avoid
   function SearchInput(props: SearchInputProps) {}
   ```

3. **Optional props**: Use `?` and provide defaults

   ```typescript
   interface ComponentProps {
     required: string;
     optional?: string;
   }

   function Component({ required, optional = "default" }: ComponentProps) {}
   ```

4. **Callback props**: Prefix with `on`

   ```typescript
   interface Props {
     onClick: () => void;
     onSubmit: (data: FormData) => void;
     onSelect: (id: string) => void;
   }
   ```

5. **Prop documentation**: All exported prop interfaces must have JSDoc comments on every property

   ```typescript
   interface SearchInputProps {
     /** Placeholder text shown when the input is empty. */
     placeholder: string;
     /** Current search string (controlled). */
     value: string;
     /** Called with the new value on every keystroke. */
     onChange: (value: string) => void;
     /** Tailwind ring-color class applied on focus. @default "ring-blue-500" */
     ringColor?: string;
   }
   ```

   Rules:
   - One-line JSDoc comment per property
   - Include `@default` tag for optional props with defaults
   - Document callback semantics (when called, what the argument is)
   - Skip JSDoc on shadcn/ui primitives (follow upstream patterns)

---

## Anti-Patterns to Avoid

### 1. Large Components

❌ **Bad**: Single component with 300+ lines

✅ **Good**: Split into focused subcomponents

```typescript
export default function ItemView() {
  return (
    <>
      <ItemHeader />
      <ItemList />
      <ItemDetails />
    </>
  );
}
```

### 2. Duplicated Code

❌ **Bad**: Copying logic across components

✅ **Good**: Extract to shared utility

```typescript
// lib/utils.ts
export function fuzzyMatch(query: string, target: string) { /* ... */ }

// In both components
import { fuzzyMatch } from "@/lib/utils";
```

### 3. Duplicated Type Definitions

❌ **Bad**: Defining the same interface in multiple files

✅ **Good**: Centralize in `types/index.ts` and import everywhere

### 4. Mixed Concerns

❌ **Bad**: Business logic in UI components

✅ **Good**: Parent component handles logic; UI component is pure

### 5. Prop Drilling

❌ **Bad**: Passing props through multiple levels

✅ **Good**: Use composition or React Context for deeply nested data

---

## Component Patterns

### Conditional Rendering States

Use early returns for loading/error/empty states:

```typescript
export default function MyComponent({ data, loading, error }: Props) {
  if (loading) return <LoadingState message="Loading..." />;
  if (error) return <ErrorState error={error} />;
  if (data.length === 0) return <EmptyState message="No data available" />;

  return <div>{/* Main content */}</div>;
}
```

### List Rendering

Always use proper keys and extract item rendering:

```typescript
function ListItem({ item, onClick }: ItemProps) {
  return (
    <li>
      <button onClick={() => onClick(item)}>{item.label}</button>
    </li>
  );
}

function ItemList({ items }: Props) {
  return (
    <ul>
      {items.map(item => (
        <ListItem key={item.id} item={item} onClick={handleClick} />
      ))}
    </ul>
  );
}
```

### Computed Values

Use `useMemo` for expensive computations:

```typescript
const sortedItems = useMemo(() => {
  return items
    .filter(item => item.active)
    .sort((a, b) => a.label.localeCompare(b.label));
}, [items]);
```

---

## Performance Guidelines

1. **Use `useMemo`** for expensive computations that depend on props/state
2. **Use `useCallback`** when passing callbacks to child components that use `React.memo`
3. **Avoid inline object/array creation** in render if passed as props
4. **Split large lists** with virtualization if > 1000 items
5. **Lazy load** components that aren't immediately visible

---

## Code Review Checklist

Before committing, verify:

- [ ] Component is < 250 lines (split if larger)
- [ ] No duplicated code
- [ ] All types defined in centralized location
- [ ] Props interface defined with proper naming
- [ ] All exported prop interfaces have JSDoc on every property
- [ ] Early returns for loading/error/empty states
- [ ] No business logic in pure UI components
- [ ] Expensive computations wrapped in `useMemo`
- [ ] Proper key attributes on list items
- [ ] Event handlers properly typed
- [ ] No `any` types used
- [ ] Imports organized (external, internal, types)
- [ ] All GraphQL types, fields, and arguments have `"""docstrings"""`
- [ ] GraphQL SDL is in `src/schema/*.graphqls`, not inline in TypeScript
- [ ] Every mutation has a corresponding subscription that publishes the result
- [ ] GraphQL subscription publish payload is wrapped as `{ fieldName: payload }`
- [ ] `PubSubTopics` defined in `src/pubsub/index.ts`; pub/sub instance created via `createAppPubSub<PubSubTopics>()`
- [ ] New entities have a Zod schema in `src/db/schemas.ts`
- [ ] New entities have a repository interface + implementation in `src/db/repository.ts`
- [ ] Resolvers import from `./db/repository.js`, not `./db/index.js` or `../storage/index.js`
- [ ] Component exported as default
- [ ] File name matches component name
- [ ] Docs updated for any new packages, templates, scripts, env vars, or architecture changes

---

## References

- [React Best Practices](https://react.dev/learn/thinking-in-react)
- [TypeScript Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)
