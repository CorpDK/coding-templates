/** PostgreSQL `smallint` range (16-bit signed). */
export const PG_SMALLINT_MIN = -32_768;
export const PG_SMALLINT_MAX = 32_767;

/** PostgreSQL `integer` range (32-bit signed). */
export const PG_INT32_MIN = -2_147_483_648;
export const PG_INT32_MAX = 2_147_483_647;

/** Signed 64-bit integer bounds (PG `bigint`, `interval` ms wire). */
export const PG_INT64_MIN = BigInt("-9223372036854775808");
export const PG_INT64_MAX = BigInt("9223372036854775807");

/** IEEE 754 binary32 finite magnitude limit (PG `real`). */
export const PG_REAL_MAX = 3.402_823_5e38;
export const PG_REAL_MIN = -PG_REAL_MAX;
