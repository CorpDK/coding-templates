import {
  bigint,
  boolean,
  char,
  date,
  doublePrecision,
  index,
  integer,
  interval,
  numeric,
  pgTable,
  real,
  smallint,
  text,
  time,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { scalarSpecimenKindEnum } from "./enums.js";
import { citext, cidr, inet, macaddr } from "./pg-custom-types.js";

/**
 * Standalone reference rows for every DAL-supported PostgreSQL → GraphQL scalar mapping.
 * Requires PostgreSQL `citext` extension for `slug_insensitive`.
 * Nullable optional columns exercise `isNull` on BigInt, Decimal, IntervalMs, enum, network, and citext filters.
 */
export const scalarSpecimens = pgTable(
  "scalar_specimens",
  {
    /** Surrogate primary key — GraphQL `ID`. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Short stable code — PG `varchar` → GraphQL `String`. */
    specimenCode: varchar("specimen_code", { length: 64 }).notNull(),
    /** Fixed-width token — PG `char(n)` → GraphQL `String`. */
    fixedCode: char("fixed_code", { length: 8 }).notNull(),
    /** Free-form notes — PG `text` → GraphQL `String`. */
    notes: text("notes").notNull(),
    /** Case-insensitive slug — PG `citext` → GraphQL `InsensitiveString`. */
    slugInsensitive: citext("slug_insensitive").notNull(),
    /** Optional citext — nullable `InsensitiveStringFilter` / `isNull` coverage. */
    slugInsensitiveOptional: citext("slug_insensitive_optional"),
    /** Signed 16-bit counter — PG `smallint` → GraphQL `SmallInt`. */
    rankSmall: smallint("rank_small").notNull(),
    /** 32-bit quantity — PG `integer` → GraphQL `Int`. */
    countInt: integer("count_int").notNull(),
    /** 64-bit token — PG `bigint` → GraphQL `BigInt` (string on wire). */
    tokenBig: bigint("token_big", { mode: "bigint" }).notNull(),
    /** Nullable bigint — `BigIntFilter.isNull`. */
    tokenBigOptional: bigint("token_big_optional", { mode: "bigint" }),
    /** Fixed-scale amount — PG `numeric` → GraphQL `Decimal` (string on wire). */
    amountDecimal: numeric("amount_decimal", {
      precision: 14,
      scale: 4,
    }).notNull(),
    /** Nullable numeric — `DecimalFilter.isNull`. */
    amountDecimalOptional: numeric("amount_decimal_optional", {
      precision: 14,
      scale: 4,
    }),
    /** IEEE single — PG `real` → GraphQL `Float`. */
    ratioFloat: real("ratio_float").notNull(),
    /** IEEE double — PG `double precision` → GraphQL `Double`. */
    ratioDouble: doublePrecision("ratio_double").notNull(),
    /** Canonical row flag — PG `boolean` → GraphQL `Boolean`. */
    isReference: boolean("is_reference").notNull().default(true),
    /** Calendar effective date — PG `date` → GraphQL `Date`. */
    effectiveOn: date("effective_on", { mode: "string" }).notNull(),
    /** Sample instant — PG `timestamptz` → GraphQL `DateTime`. */
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    /** Daily open time — PG `timetz` → GraphQL `TimeTz`. */
    opensAt: time("opens_at", { withTimezone: true }).notNull(),
    /** Elapsed duration — PG `interval` → GraphQL `IntervalMs` (ms on wire). */
    durationMs: interval("duration_ms").notNull(),
    /** Nullable interval — `IntervalMsFilter.isNull`. */
    durationMsOptional: interval("duration_ms_optional"),
    /** Host address — PG `inet` → GraphQL `IP`. */
    hostIp: inet("host_ip").notNull(),
    /** Optional host — `IPFilter.isNull`. */
    hostIpOptional: inet("host_ip_optional"),
    /** Routed prefix — PG `cidr` → GraphQL `CIDR`. */
    networkCidr: cidr("network_cidr").notNull(),
    /** Optional prefix — `CIDRFilter.isNull`. */
    networkCidrOptional: cidr("network_cidr_optional"),
    /** NIC hardware address — PG `macaddr` → GraphQL `MAC`. */
    nicMac: macaddr("nic_mac").notNull(),
    /** Optional MAC — `MACFilter.isNull`. */
    nicMacOptional: macaddr("nic_mac_optional"),
    /** Specimen category — Drizzle `pgEnum` → GraphQL enum. */
    kind: scalarSpecimenKindEnum("kind").notNull().default("REFERENCE"),
    /** Nullable enum — `<ScalarSpecimenKind>Filter.isNull`. */
    kindOptional: scalarSpecimenKindEnum("kind_optional"),
    /** Row creation time (UTC) — audit `timestamptz` → GraphQL `DateTime`. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Last update time (UTC). */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Actor ID from request context; never client-supplied. */
    createdBy: text("created_by").notNull(),
    /** Actor ID from request context on last update. */
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [
    index("scalar_specimens_specimen_code_idx").on(table.specimenCode),
  ],
);
