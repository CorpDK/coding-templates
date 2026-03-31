# Repository Pattern

All DS packages use a Repository Pattern to keep GraphQL resolvers decoupled from the storage backend.

---

## Required Structure

Every DS package must maintain this layout in `src/db/`:

```
src/
  db/
    schemas.ts      ← Zod schemas: one per entity (e.g. ItemSchema, OrderSchema)
    repository.ts   ← IRepository interfaces + this package's implementations
```

---

## Adding a New Entity

When adding a new table or document type (e.g. `Order`), follow all four steps in order.

### 1. Add the Zod schema to `src/db/schemas.ts`

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

### 2. Extend the storage layer

| Package | Action |
|---------|--------|
| `ds` (Prisma) | Add the model to `prisma/schema.prisma`, run `pnpm db:migrate` |
| `ds-hprt` (Drizzle) | Add the table to `drizzle/schema.ts`, run `pnpm db:generate && pnpm db:migrate` |
| `ds-mongo`, `ds-ddb` | Add a typed collection to `src/db/index.ts` |
| `ds-cdb` | Use the existing cluster/scope, add a collection if needed |
| `ds-file` | Add `getOrders()`/`saveOrders()` pair to `src/storage/index.ts` |

### 3. Add the repository to `src/db/repository.ts`

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

### 4. Use the repository in `schema.ts`

Import from `./db/repository.js` — never from `./db/index.js` or `../storage/index.js`:

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

---

## Anti-Pattern: Direct DB Calls in Resolvers

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

---

## Rules

1. **Resolvers must not import from `./db/index.js` or `../storage/index.js`** — use `./db/repository.js` only
2. **All Zod schemas live in `src/db/schemas.ts`** — no inline schema definitions in resolvers
3. **Input validation happens in resolvers**, not in repository methods — parse with Zod before calling `repository.create()`
4. **Repository methods return the application type**, not raw ORM/driver types — map and validate with `ItemSchema.parse()` on the way out
5. **One interface per entity** — `IItemRepository`, `IOrderRepository`, etc. — grouped in the same `repository.ts` file

---

**Related**: [GraphQL Schema](02-graphql-schema.md) | [Data Service Design](../architecture/03-data-service-design.md)

**Last updated**: March 31, 2026
