import { customType } from "drizzle-orm/pg-core";

/** PostgreSQL `citext` — requires `CREATE EXTENSION citext;` in the database. */
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

/** PostgreSQL `inet` host address (IPv4 or IPv6). */
export const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return "inet";
  },
});

/** PostgreSQL `cidr` network prefix. */
export const cidr = customType<{ data: string; driverData: string }>({
  dataType() {
    return "cidr";
  },
});

/** PostgreSQL `macaddr` IEEE 802 MAC address. */
export const macaddr = customType<{ data: string; driverData: string }>({
  dataType() {
    return "macaddr";
  },
});
