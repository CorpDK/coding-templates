# Coding Guidelines

This document outlines the coding standards and best practices for this project.

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
- Use strict typing - avoid `any` type
- Define shared types in centralized location (`types/` directory)
- Export and reuse type definitions across files

## Project Structure

### Directory Organization

```
├── app/                     # Next.js App Router pages
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main page (orchestration only)
├── components/             # React components
│   └── ui/                 # Reusable UI primitives
│       ├── LoadingState.tsx
│       ├── ErrorState.tsx
│       ├── EmptyState.tsx
│       ├── SearchInput.tsx
│       └── FilterButton.tsx
├── lib/                    # Utility functions
│   ├── utils.ts            # Shared utilities (cn, fuzzyMatch, formatTimestamp)
│   ├── search.ts           # Fuzzy search
│   ├── formatting.ts       # Date/string formatting
│   └── constants.ts        # App-wide constants
├── types/                  # TypeScript type definitions
│   └── index.ts            # Shared type definitions
└── public/                 # Static assets
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

## Anti-Patterns to Avoid

### 1. Large Components

❌ **Bad**: Single component with 300+ lines

```typescript
export default function ItemView() {
  // 300 lines of logic and rendering...
}
```

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

```typescript
// In ComponentA
function fuzzyMatch(query: string, target: string) {
  /* ... */
}

// In ComponentB
function fuzzyMatch(query: string, target: string) {
  /* ... */
}
```

✅ **Good**: Extract to shared utility

```typescript
// lib/utils.ts
export function fuzzyMatch(query: string, target: string) {
  /* ... */
}

// In both components
import { fuzzyMatch } from "@/lib/utils";
```

### 3. Duplicated Type Definitions

❌ **Bad**: Defining same interface in multiple files

```typescript
// fileA.tsx
interface Item {
  /* ... */
}

// fileB.tsx
interface Item {
  /* ... */
}
```

✅ **Good**: Centralize in types directory

```typescript
// types/index.ts
export interface Item {
  /* ... */
}

// Import in both files
import { Item } from "@/types/index";
```

### 4. Mixed Concerns

❌ **Bad**: Business logic in UI components

```typescript
function Button({ items }: { items: Item[] }) {
  const filtered = items.filter(i => i.active);
  const sorted = filtered.sort((a, b) => a.label.localeCompare(b.label));

  return <button>Show {sorted.length} items</button>;
}
```

✅ **Good**: Separate concerns

```typescript
// Parent component handles logic
function ParentView() {
  const activeItems = useMemo(() => {
    return items
      .filter(i => i.active)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  return <CountButton count={activeItems.length} />;
}

// UI component is pure
function CountButton({ count }: { count: number }) {
  return <button>Show {count} items</button>;
}
```

### 5. Prop Drilling

❌ **Bad**: Passing props through multiple levels

```typescript
<GrandParent data={data}>
  <Parent data={data}>
    <Child data={data}>
      <GrandChild data={data} />
    </Child>
  </Parent>
</GrandParent>
```

✅ **Good**: Use composition or context for deeply nested data

```typescript
// Option 1: Flatten component hierarchy
<GrandParent>
  <GrandChild data={data} />
</GrandParent>

// Option 2: Use React Context for global state
const DataContext = createContext<Data | null>(null);
```

## Component Patterns

### 1. Conditional Rendering States

Use early returns for loading/error/empty states:

```typescript
export default function MyComponent({ data, loading, error }: Props) {
  if (loading) {
    return <LoadingState message="Loading..." />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (data.length === 0) {
    return <EmptyState message="No data available" />;
  }

  return (
    <div>
      {/* Main content */}
    </div>
  );
}
```

### 2. List Rendering

Always use proper keys and extract item rendering:

```typescript
// Extract item component
function ListItem({ item, onClick }: ItemProps) {
  return (
    <li>
      <button onClick={() => onClick(item)}>
        {item.label}
      </button>
    </li>
  );
}

// Use in list
function ItemList({ items }: Props) {
  return (
    <ul>
      {items.map(item => (
        <ListItem
          key={item.id}
          item={item}
          onClick={handleClick}
        />
      ))}
    </ul>
  );
}
```

### 3. Computed Values

Use `useMemo` for expensive computations:

```typescript
function MyComponent({ items }: Props) {
  // Memoize expensive filtering/sorting
  const sortedItems = useMemo(() => {
    return items
      .filter(item => item.active)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  return <div>{/* Use sortedItems */}</div>;
}
```

### 4. Event Handlers

Define handlers before render, use inline arrows for simple callbacks:

```typescript
function MyComponent({ onSave }: Props) {
  // Complex handler - defined before render
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Complex logic...
    onSave(data);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {/* Simple callback - inline arrow */}
        <button onClick={() => console.log('clicked')}>
          Click
        </button>
      </form>
    </div>
  );
}
```

## Performance Guidelines

1. **Use `useMemo`** for expensive computations that depend on props/state
2. **Use `useCallback`** when passing callbacks to child components that use `React.memo`
3. **Avoid inline object/array creation** in render if passed as props
4. **Split large lists** with virtualization if > 1000 items
5. **Lazy load** components that aren't immediately visible

## Testing Considerations

1. **Pure components are easier to test** - they have predictable outputs
2. **Extract business logic** to utility functions for easier unit testing
3. **Use data-testid** attributes for integration tests
4. **Mock external dependencies** in component tests

## Documentation

1. **Add JSDoc comments** for complex functions
2. **Document props** with inline comments when behavior isn't obvious
3. **Keep README.md updated** with architectural decisions
4. **Update CLAUDE.md** when changing project structure or patterns

## Data Access / Repository Pattern

All DS packages use a **Repository Pattern** to keep GraphQL resolvers decoupled from the storage backend.

### Required Structure

Every DS package must maintain this layout in `src/db/`:

```text
src/
  db/
    schemas.ts      ← Zod schemas: one per entity (e.g. ItemSchema, OrderSchema)
    repository.ts   ← IRepository interfaces + this package's implementations
```

### Adding a New Entity

When adding a new table or document type (e.g. `Order`), follow all four steps:

#### 1. Add the Zod schema to `src/db/schemas.ts`

```typescript
export const OrderSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  createdAt: z.string().datetime(),
});

export type Order = z.infer<typeof OrderSchema>;

export const CreateOrderInputSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
```

#### 2. Extend the storage layer

- **Prisma (`ds`)**: add the model to `prisma/schema.prisma`, run `pnpm db:migrate`
- **Drizzle (`ds-hprt`)**: add the table to `drizzle/schema.ts`, run `pnpm db:generate && pnpm db:migrate`
- **MongoDB / DocumentDB**: add a typed collection to `src/db/index.ts`
- **Couchbase**: use the existing cluster/scope, add a collection if needed
- **File (`ds-file`)**: add a `getOrders()`/`saveOrders()` pair to `src/storage/index.ts`

#### 3. Add the repository to `src/db/repository.ts`

Define the interface and implement it with the package's native storage API:

```typescript
export interface IOrderRepository {
  findAll(): Promise<Order[]>;
  findOne(id: string): Promise<Order | null>;
  create(order: Order): Promise<Order>;
}

export const orderRepository: IOrderRepository = {
  findAll: async () => { /* storage-specific implementation */ },
  findOne: async (id) => { /* storage-specific implementation */ },
  create: async (order) => { /* storage-specific implementation */ },
};
```

#### 4. Use the repository in `schema.ts`

Import from `./db/repository.js` — never from `./db/index.js` or `../storage/index.js` directly:

```typescript
import { orderRepository } from "./db/repository.js";
import { CreateOrderInputSchema, OrderSchema, type Order } from "./db/schemas.js";

// In resolvers:
orders: () => orderRepository.findAll(),
order: (_, { id }) => orderRepository.findOne(id),
createOrder: async (_, args) => {
  const input = CreateOrderInputSchema.parse(args);
  const order: Order = OrderSchema.parse({ id: randomUUID(), ...input, createdAt: new Date().toISOString() });
  const created = await orderRepository.create(order);
  pubsub.publish("ORDER_CREATED", { orderCreated: created });
  return created;
},
```

### Anti-Pattern: Direct DB Calls in Resolvers

❌ **Bad** — resolver depends on the MongoDB driver directly:

```typescript
// schema.ts
import { getDb } from "./db/index.js";

orders: async () => {
  const docs = await getDb().orders.find({}).toArray();
  return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
},
```

✅ **Good** — resolver calls only the repository interface:

```typescript
// schema.ts
import { orderRepository } from "./db/repository.js";

orders: () => orderRepository.findAll(),
```

### Repository Rules

1. **Resolvers must not import from `./db/index.js` or `../storage/index.js`** — use `./db/repository.js` only
2. **All Zod schemas live in `src/db/schemas.ts`** — no inline schema definitions in resolvers
3. **Input validation happens in resolvers**, not in repository methods — parse with Zod before calling `repository.create()`
4. **Repository methods return the application `Item`/`Order` type**, not raw ORM/driver types — map and validate with `ItemSchema.parse()` on the way out
5. **One interface per entity** — `IItemRepository`, `IOrderRepository`, etc. — grouped in the same `repository.ts` file

## GraphQL Schema Documentation

The GraphQL schema lives in `src/schema/` — a directory of `.graphqls` files, not inline TypeScript. `schema.ts` scans the directory at runtime, sorts files alphabetically, and merges them into a single SDL string. The codegen config (`codegen.ts`) uses the glob `./src/schema/**/*.graphqls`.

### Schema Directory Layout

```text
src/schema/
├── base.graphqls      ← declares empty root types: type Query / Mutation / Subscription
├── server.graphqls    ← server health types + extend type Query/Mutation/Subscription
└── item.graphqls      ← Item type + extend type Query/Mutation/Subscription
```

**Adding a new entity** = create one new file (e.g. `src/schema/order.graphqls`) with the type definition and `extend type` blocks for its operations. No other files need editing.

```graphql
"""An order."""
type Order {
  """..."""
  id: ID!
}

extend type Query {
  """Returns all orders."""
  orders: [Order!]!
}

extend type Mutation {
  """Creates a new order. Publishes orderCreated."""
  createOrder(itemId: ID!): Order!
}

extend type Subscription {
  """Fires when an order is created via createOrder."""
  orderCreated: Order!
}
```

Every element of a GraphQL schema **must** have a `"""docstring"""`. The schema is the public API contract — Altair, GraphQL IDE explorers, and generated SDK consumers all rely on these descriptions.

### Required Coverage

| Element | Requirement |
|---------|-------------|
| Root types (`Query`, `Mutation`, `Subscription`) | One-line description of the operation category |
| Object types | One-line description of what the type represents |
| Every field | What the field returns and when it's useful |
| Every argument | What the argument controls or filters |
| Enum values | What each value means |

### Example

❌ **Bad** — no descriptions, blank in Altair Docs:

```graphql
type Query {
  hello(name: String): String!
  status: ServerStatus!
}

type ServerStatus {
  ok: Boolean!
  timestamp: String!
}
```

✅ **Good** — fully documented:

```graphql
"""Entry points for read-only data fetching."""
type Query {
  """Returns a personalised greeting. Omit name to receive the default."""
  hello(
    """Optional name to include in the greeting."""
    name: String
  ): String!

  """Returns the current server health status and a server-side timestamp."""
  status: ServerStatus!
}

"""Current health state of the server."""
type ServerStatus {
  """True when the server is operating normally."""
  ok: Boolean!

  """ISO-8601 timestamp of when this status was generated."""
  timestamp: String!
}
```

### Rules

1. **No bare types** — every `type`, `input`, `enum`, `interface`, `union`, and `scalar` needs a description
2. **No bare fields** — every field needs a description, even if it seems obvious (`id`, `createdAt`)
3. **No bare arguments** — every argument needs a description explaining what it filters or controls
4. **Use ISO-8601 in timestamp descriptions** — e.g. `"ISO-8601 timestamp of when..."`
5. **Mutations describe their side effect** — include what gets published/triggered, not just what gets returned
6. **Subscriptions describe their trigger** — explain what mutation or event fires the subscription

## GraphQL Mutations and Subscriptions

**Every mutation must be accompanied by a corresponding subscription.** Mutations publish a PubSub event; clients subscribe for real-time feedback without polling. This is a hard requirement — do not add a mutation without its subscription counterpart.

### Required Pattern

Add a `Subscription` type entry for every mutation:

```graphql
type Mutation {
  """Creates a new document record. Publishes documentCreated."""
  createDocument(input: CreateDocumentInput!): Document!
}

type Subscription {
  """Fires when a document is created via the createDocument mutation."""
  documentCreated: Document!
}
```

## GraphQL Subscription Resolvers

Leverage Yoga's default field-name resolver — no explicit `resolve` function needed.

### How Yoga's Default Works

Yoga maps each subscription event to `event[fieldName]`. For a field named `pingSent`, it evaluates `event.pingSent`. Wrap the payload under the field name when publishing and Yoga handles the rest.

### Required Pattern

Create the pub/sub instance using `@corpdk/pub-sub` and define topics locally in `src/pubsub/index.ts`:

```typescript
import { createAppPubSub } from "@corpdk/pub-sub";

export type PubSubTopics = {
  PING_SENT: [{ pingSent: { message: string; timestamp: string } }];
  // add a topic for each subscription field
};

export const pubsub = createAppPubSub<PubSubTopics>();
export type PubSub = typeof pubsub;
```

`createAppPubSub<T>()` automatically selects Redis (when `REDIS_URL` is set) or in-memory. Never import `createMemoryEventTarget` or `createRedisEventTarget` directly in DS packages — use the factory.

**`PubSubTopics`** — wrap payload under the field name:

**Mutation** — publish with the wrapper:

```typescript
pubsub.publish("PING_SENT", { pingSent: result });
```

**Subscription resolver** — `subscribe` only, no `resolve`:

```typescript
pingSent: {
  subscribe: () => pubsub.subscribe("PING_SENT"),
},
```

❌ **Bad** — publishing the payload directly causes `Cannot return null for non-nullable field`:

```typescript
// PubSubTopics
PING_SENT: [{ message: string; timestamp: string }];

// Mutation
pubsub.publish("PING_SENT", result); // event.pingSent → undefined → null error

// Resolver
pingSent: {
  subscribe: () => pubsub.subscribe("PING_SENT"),
},
```

### Rule

Always publish as `{ fieldName: payload }`. The topic payload type in `PubSubTopics` must mirror this shape. Never add a custom `resolve` just to pass the event through — fix the publish shape instead.

## Code Review Checklist

Before committing, verify:

- [ ] Component is < 250 lines (split if larger)
- [ ] No duplicated code
- [ ] All types defined in centralized location
- [ ] Props interface defined with proper naming
- [ ] Early returns for loading/error/empty states
- [ ] No business logic in pure UI components
- [ ] Expensive computations wrapped in useMemo
- [ ] Proper key attributes on list items
- [ ] Event handlers properly typed
- [ ] No `any` types used
- [ ] Imports organized (external, internal, types)
- [ ] All GraphQL types, fields, and arguments have `"""docstrings"""`
- [ ] GraphQL SDL is in `src/schema.graphqls`, not inline in TypeScript
- [ ] Every mutation has a corresponding subscription that publishes the result
- [ ] GraphQL subscription publish payload is wrapped as `{ fieldName: payload }`
- [ ] `PubSubTopics` defined in `src/pubsub/index.ts`; pub/sub instance created via `createAppPubSub<PubSubTopics>()` from `@corpdk/pub-sub`
- [ ] New entities have a Zod schema in `src/db/schemas.ts`
- [ ] New entities have a repository interface + implementation in `src/db/repository.ts`
- [ ] Resolvers import from `./db/repository.js`, not `./db/index.js` or `../storage/index.js`
- [ ] Component exported as default
- [ ] File name matches component name

## Git Commit Messages

Follow conventional commits format:

```
<target>: <description>

[optional body]

[optional footer]
```
Target:

`<type>[(<component>)]:`

The Component section is optional.

Types:

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring without changing behavior
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example 1:

```
refactor: Extract header components into reusable modules

- Created SystemInfo component for metadata display
- Split Legend into separate component
- Reduced page.tsx size by 45%

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Example 2:

```
refactor(ui): Extract header components into reusable modules

- Created SystemInfo component for metadata display
- Split Legend into separate component
- Reduced page.tsx size by 45%

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## State Management

Choose based on complexity and team context:

| Choice | Use when |
|--------|----------|
| **Zustand** | Default. Simple API, minimal boilerplate, works for most cases. |
| **Jotai** | Prefer atom-based reactivity: highly modular state, complex UI dependency graphs, or fine-grained re-render control. |
| **Redux Toolkit** | Large team with strict conventions, advanced middleware needs, time-travel debugging, or enterprise compliance requirements. |

Never reach for a heavier solution before exhausting the simpler one. React `useState` + `useContext` is still the right answer for purely local or lightly shared state.

## References

- [React Best Practices](https://react.dev/learn/thinking-in-react)
- [TypeScript Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)
