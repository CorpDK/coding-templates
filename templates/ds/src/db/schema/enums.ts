import { pgEnum } from "drizzle-orm/pg-core";

/** Order lifecycle states from placement through completion or cancellation. */
export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

/** Scalar showcase row classification for GraphQL enum coverage. */
export const scalarSpecimenKindEnum = pgEnum("scalar_specimen_kind", [
  "REFERENCE",
  "EDGE_CASE",
]);
