/**
 * Sample commerce ER for DAL codegen — catalog, checkout, and supporting DAL scenarios.
 *
 * | Entity       | Role / DAL coverage                                  |
 * |--------------|------------------------------------------------------|
 * | users        | customers; 1:M orders; M:N labels via userLabels     |
 * | categories   | catalog grouping; full audit, hard delete            |
 * | items        | catalog SKU; M:1 category; soft delete               |
 * | itemDetails  | 1:1 extended specs for items                         |
 * | tags         | append-only audit, soft delete                       |
 * | itemTags     | enriched M:N items ↔ tags                            |
 * | orders       | user checkout; soft delete, pgEnum status, PII name  |
 * | orderLines   | one item per line (FK itemId), qty, order FK         |
 * | labels       | user segmentation (M:N via userLabels)               |
 * | userLabels   | pure M:N junction (soft-deletable links)             |
 * | auditEvents  | append-only audit log (no FK)                        |
 * | phase5Widgets| Phase 5 column constraints (standalone)              |
 */
export * from "./audit-events.js";
export * from "./categories.js";
export * from "./enums.js";
export * from "./item-details.js";
export * from "./item-tags.js";
export * from "./items.js";
export * from "./labels.js";
export * from "./order-lines.js";
export * from "./orders.js";
export * from "./phase5-widgets.js";
export * from "./relations.js";
export * from "./tags.js";
export * from "./user-labels.js";
export * from "./users.js";
