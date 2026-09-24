import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { auditEvents } from "./schema/audit-events.js";
import { categories } from "./schema/categories.js";
import { demoTags } from "./schema/demo-tags.js";
import { demoUserTags } from "./schema/demo-user-tags.js";
import { demoUsers } from "./schema/demo-users.js";
import { itemDetails } from "./schema/item-details.js";
import { itemTags } from "./schema/item-tags.js";
import { items } from "./schema/items.js";
import { orderLines } from "./schema/order-lines.js";
import { orders } from "./schema/orders.js";
import { tags } from "./schema/tags.js";
import * as schema from "./schema/index.js";

const ACTOR = "seed";
const SEEDED_AT = new Date("2026-01-15T10:00:00.000Z");
const TAG_ASSIGNED_EARLIER = new Date("2026-01-10T14:30:00.000Z");
const TAG_ASSIGNED_LATER = new Date("2026-01-12T09:15:00.000Z");

/** Stable UUIDs so re-runs are safe when tables are empty but inserts partially succeeded. */
const IDS = {
  categories: {
    electronics: "a1000001-0000-4000-8000-000000000001",
    apparel: "a1000001-0000-4000-8000-000000000002",
    books: "a1000001-0000-4000-8000-000000000003",
  },
  tags: {
    featured: "a2000001-0000-4000-8000-000000000001",
    sale: "a2000001-0000-4000-8000-000000000002",
    bestseller: "a2000001-0000-4000-8000-000000000003",
  },
  items: {
    headphones: "a3000001-0000-4000-8000-000000000001",
    usbDock: "a3000001-0000-4000-8000-000000000002",
    cottonTee: "a3000001-0000-4000-8000-000000000003",
    woolBeanie: "a3000001-0000-4000-8000-000000000004",
    graphqlBook: "a3000001-0000-4000-8000-000000000005",
  },
  itemDetails: {
    headphones: "a3500001-0000-4000-8000-000000000001",
    usbDock: "a3500001-0000-4000-8000-000000000002",
    cottonTee: "a3500001-0000-4000-8000-000000000003",
    woolBeanie: "a3500001-0000-4000-8000-000000000004",
    graphqlBook: "a3500001-0000-4000-8000-000000000005",
  },
  itemTags: {
    headphonesFeatured: "a4000001-0000-4000-8000-000000000001",
    headphonesBestseller: "a4000001-0000-4000-8000-000000000002",
    usbDockSale: "a4000001-0000-4000-8000-000000000003",
    cottonTeeSale: "a4000001-0000-4000-8000-000000000004",
    woolBeanieFeatured: "a4000001-0000-4000-8000-000000000005",
    graphqlBookBestseller: "a4000001-0000-4000-8000-000000000006",
  },
  orders: {
    alicePending: "a5000001-0000-4000-8000-000000000001",
    bobCompleted: "a5000001-0000-4000-8000-000000000002",
  },
  orderLines: {
    aliceHeadphones: "a6000001-0000-4000-8000-000000000001",
    aliceBook: "a6000001-0000-4000-8000-000000000002",
    bobTee: "a6000001-0000-4000-8000-000000000003",
    bobBeanie: "a6000001-0000-4000-8000-000000000004",
  },
  auditEvents: {
    categoriesCreated: "a7000001-0000-4000-8000-000000000001",
    orderPlaced: "a7000001-0000-4000-8000-000000000002",
    itemsTagged: "a7000001-0000-4000-8000-000000000003",
  },
  demoUsers: {
    alice: "b1000001-0000-4000-8000-000000000001",
  },
  demoTags: {
    earlyAdopter: "b2000001-0000-4000-8000-000000000001",
    beta: "b2000001-0000-4000-8000-000000000002",
  },
  demoUserTags: {
    aliceEarlyAdopter: "b3000001-0000-4000-8000-000000000001",
    aliceBeta: "b3000001-0000-4000-8000-000000000002",
  },
} as const;

export async function seedDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories);

    if (row.count > 0) {
      console.log("[seed] Sample data already present — skipping.");
      await seedDemoM2mIfEmpty(db);
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .insert(categories)
        .values([
          {
            id: IDS.categories.electronics,
            name: "Electronics",
            description: "Consumer electronics and accessories",
            isVisible: true,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.categories.apparel,
            name: "Apparel",
            description: "Clothing and wearables",
            isVisible: true,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.categories.books,
            name: "Books",
            description: "Technical and general interest books",
            isVisible: true,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(tags)
        .values([
          {
            id: IDS.tags.featured,
            label: "featured",
            createdAt: SEEDED_AT,
            createdBy: ACTOR,
          },
          {
            id: IDS.tags.sale,
            label: "sale",
            createdAt: SEEDED_AT,
            createdBy: ACTOR,
          },
          {
            id: IDS.tags.bestseller,
            label: "bestseller",
            createdAt: SEEDED_AT,
            createdBy: ACTOR,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(items)
        .values([
          {
            id: IDS.items.headphones,
            categoryId: IDS.categories.electronics,
            name: "Wireless Headphones",
            description: "Noise-cancelling over-ear headphones with 30-hour battery life",
            isActive: true,
            hasAttachments: false,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.items.usbDock,
            categoryId: IDS.categories.electronics,
            name: "USB-C Docking Station",
            description: "12-port hub with dual 4K display support",
            isActive: true,
            hasAttachments: true,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.items.cottonTee,
            categoryId: IDS.categories.apparel,
            name: "Organic Cotton Tee",
            description: "Unisex crew neck in natural dye colors",
            isActive: true,
            hasAttachments: false,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.items.woolBeanie,
            categoryId: IDS.categories.apparel,
            name: "Merino Wool Beanie",
            description: "Lightweight winter beanie — currently restocking",
            isActive: false,
            hasAttachments: false,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.items.graphqlBook,
            categoryId: IDS.categories.books,
            name: "GraphQL in Action",
            description: "Practical guide to schema design and server implementation",
            isActive: true,
            hasAttachments: false,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(itemDetails)
        .values([
          {
            id: IDS.itemDetails.headphones,
            itemId: IDS.items.headphones,
            specifications:
              "Driver: 40mm dynamic; Frequency: 20Hz–20kHz; Bluetooth 5.3; ANC: hybrid feedforward/feedback",
            warrantyNotes: "2-year limited warranty; battery covered for 1 year",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.itemDetails.usbDock,
            itemId: IDS.items.usbDock,
            specifications:
              "Ports: 2× USB-A 3.2, 2× USB-C, HDMI 2.0, DisplayPort 1.4, SD/microSD, Ethernet 1GbE",
            warrantyNotes: "3-year warranty with advance replacement",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.itemDetails.cottonTee,
            itemId: IDS.items.cottonTee,
            specifications: "Fabric: 100% organic cotton; Weight: 180 gsm; Fit: relaxed unisex",
            warrantyNotes: "30-day satisfaction guarantee; defects replaced within 90 days",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.itemDetails.woolBeanie,
            itemId: IDS.items.woolBeanie,
            specifications: "Material: 100% merino wool; Weight: 85 gsm; One size",
            warrantyNotes: "1-year warranty against manufacturing defects",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.itemDetails.graphqlBook,
            itemId: IDS.items.graphqlBook,
            specifications: "Format: paperback; Pages: 384; Publisher: Manning; ISBN: 978-1617294736",
            warrantyNotes: "Standard publisher return policy applies",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(itemTags)
        .values([
          {
            id: IDS.itemTags.headphonesFeatured,
            itemId: IDS.items.headphones,
            tagId: IDS.tags.featured,
            assignedAt: TAG_ASSIGNED_EARLIER,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.itemTags.headphonesBestseller,
            itemId: IDS.items.headphones,
            tagId: IDS.tags.bestseller,
            assignedAt: TAG_ASSIGNED_LATER,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.itemTags.usbDockSale,
            itemId: IDS.items.usbDock,
            tagId: IDS.tags.sale,
            assignedAt: TAG_ASSIGNED_EARLIER,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.itemTags.cottonTeeSale,
            itemId: IDS.items.cottonTee,
            tagId: IDS.tags.sale,
            assignedAt: TAG_ASSIGNED_LATER,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.itemTags.woolBeanieFeatured,
            itemId: IDS.items.woolBeanie,
            tagId: IDS.tags.featured,
            assignedAt: TAG_ASSIGNED_EARLIER,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.itemTags.graphqlBookBestseller,
            itemId: IDS.items.graphqlBook,
            tagId: IDS.tags.bestseller,
            assignedAt: TAG_ASSIGNED_LATER,
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(orders)
        .values([
          {
            id: IDS.orders.alicePending,
            customerName: "Alice Chen",
            notes: "Gift wrap please",
            status: "PENDING",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.orders.bobCompleted,
            customerName: "Bob Martinez",
            notes: null,
            status: "COMPLETED",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(orderLines)
        .values([
          {
            id: IDS.orderLines.aliceHeadphones,
            orderId: IDS.orders.alicePending,
            sku: "WH-001",
            description: "Wireless Headphones — matte black",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.orderLines.aliceBook,
            orderId: IDS.orders.alicePending,
            sku: "BOOK-001",
            description: "GraphQL in Action — paperback",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.orderLines.bobTee,
            orderId: IDS.orders.bobCompleted,
            sku: "APP-TSH-001",
            description: "Organic Cotton Tee — medium / natural",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
          {
            id: IDS.orderLines.bobBeanie,
            orderId: IDS.orders.bobCompleted,
            sku: "APP-BNI-001",
            description: "Merino Wool Beanie — charcoal",
            createdAt: SEEDED_AT,
            updatedAt: SEEDED_AT,
            createdBy: ACTOR,
            updatedBy: ACTOR,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(auditEvents)
        .values([
          {
            id: IDS.auditEvents.categoriesCreated,
            action: "SEED_CATEGORY_CREATED",
            payload: "Inserted 3 sample categories: Electronics, Apparel, Books",
            createdAt: SEEDED_AT,
            createdBy: ACTOR,
          },
          {
            id: IDS.auditEvents.orderPlaced,
            action: "SEED_ORDER_PLACED",
            payload: `Order ${IDS.orders.alicePending} placed by Alice Chen (PENDING)`,
            createdAt: SEEDED_AT,
            createdBy: ACTOR,
          },
          {
            id: IDS.auditEvents.itemsTagged,
            action: "SEED_ITEM_TAGGED",
            payload: "Linked 6 item-tag associations across 5 catalog items",
            createdAt: SEEDED_AT,
            createdBy: ACTOR,
          },
        ])
        .onConflictDoNothing();
    });

    console.log(
      "[seed] Loaded sample data: 3 categories, 5 items, 5 item-details, 3 tags, 6 item-tags, 2 orders, 4 order lines, 3 audit events.",
    );

    await seedDemoM2mIfEmpty(db);
  } finally {
    await pool.end();
  }
}

async function seedDemoM2mIfEmpty(db: ReturnType<typeof drizzle<typeof schema>>): Promise<void> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(demoUsers);
  if (row.count > 0) {
    console.log("[seed] Demo M:N sample already present — skipping.");
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(demoUsers)
      .values([
        {
          id: IDS.demoUsers.alice,
          name: "Alice Demo",
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
          createdBy: ACTOR,
          updatedBy: ACTOR,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(demoTags)
      .values([
        {
          id: IDS.demoTags.earlyAdopter,
          label: "early-adopter",
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
          createdBy: ACTOR,
          updatedBy: ACTOR,
        },
        {
          id: IDS.demoTags.beta,
          label: "beta",
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
          createdBy: ACTOR,
          updatedBy: ACTOR,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(demoUserTags)
      .values([
        {
          id: IDS.demoUserTags.aliceEarlyAdopter,
          demoUserId: IDS.demoUsers.alice,
          demoTagId: IDS.demoTags.earlyAdopter,
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
          createdBy: ACTOR,
          updatedBy: ACTOR,
        },
        {
          id: IDS.demoUserTags.aliceBeta,
          demoUserId: IDS.demoUsers.alice,
          demoTagId: IDS.demoTags.beta,
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
          createdBy: ACTOR,
          updatedBy: ACTOR,
        },
      ])
      .onConflictDoNothing();
  });

  console.log("[seed] Loaded demo M:N: 1 demo user, 2 demo tags, 2 user-tag links.");
}

const isMainModule =
  process.argv[1]?.endsWith("/seed.ts") || process.argv[1]?.endsWith("/seed.js");

if (isMainModule) {
  try {
    await seedDatabase();
    process.exit(0);
  } catch (error: unknown) {
    console.error("[seed] Failed:", error);
    process.exit(1);
  }
}
