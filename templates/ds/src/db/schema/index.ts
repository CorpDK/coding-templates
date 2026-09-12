/**
 * DAL codegen test fixture schema — one entity per design guideline scenario.
 *
 * | Entity       | Tests                                              |
 * |--------------|----------------------------------------------------|
 * | categories   | full audit, hard delete, boolean is_*              |
 * | items        | full audit, soft delete, M:1 FK, is_* / has_*    |
 * | itemDetails  | 1:1 dependent, full audit, hard delete, unique FK |
 * | tags         | append-only audit, soft delete                     |
 * | itemTags     | enriched M:N junction, assignedAt, full audit      |
 * | auditEvents  | append-only audit, hard delete, immutable rows     |
 * | orders       | full audit, soft delete, pgEnum (UPPERCASE)        |
 * | orderLines   | full audit, hard delete, 1:M child FK              |
 */
export * from "./audit-events.js";
export * from "./categories.js";
export * from "./enums.js";
export * from "./item-details.js";
export * from "./item-tags.js";
export * from "./items.js";
export * from "./order-lines.js";
export * from "./orders.js";
export * from "./relations.js";
export * from "./tags.js";
