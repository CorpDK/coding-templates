import { relations } from "drizzle-orm";
import { auditEvents } from "./audit-events.js";
import { categories } from "./categories.js";
import { itemDetails } from "./item-details.js";
import { itemTags } from "./item-tags.js";
import { items } from "./items.js";
import { orderLines } from "./order-lines.js";
import { orders } from "./orders.js";
import { tags } from "./tags.js";

export const categoriesRelations = relations(categories, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  category: one(categories, {
    fields: [items.categoryId],
    references: [categories.id],
  }),
  detail: one(itemDetails),
  itemTags: many(itemTags),
}));

export const itemDetailsRelations = relations(itemDetails, ({ one }) => ({
  item: one(items, {
    fields: [itemDetails.itemId],
    references: [items.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  itemTags: many(itemTags),
}));

export const itemTagsRelations = relations(itemTags, ({ one }) => ({
  item: one(items, {
    fields: [itemTags.itemId],
    references: [items.id],
  }),
  tag: one(tags, {
    fields: [itemTags.tagId],
    references: [tags.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  lines: many(orderLines),
}));

export const orderLinesRelations = relations(orderLines, ({ one }) => ({
  order: one(orders, {
    fields: [orderLines.orderId],
    references: [orders.id],
  }),
}));

/** auditEvents has no FK relations — standalone append-only log. */
export const auditEventsRelations = relations(auditEvents, () => ({}));
