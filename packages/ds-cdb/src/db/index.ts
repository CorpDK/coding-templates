import {
  connect,
  type Cluster,
  type Bucket,
  type Scope,
  type Collection,
} from "couchbase";

interface Db {
  cluster: Cluster;
  bucket: Bucket;
  scope: Scope;
  /** Collection for Item documents. */
  items: Collection;
}

let db: Db | null = null;

/**
 * Establishes the Couchbase connection.
 * Must be called once at server startup before any resolver accesses the DB.
 *
 * Required env vars:
 *   DS_CDB_CONNECTION_STRING  e.g. couchbase://localhost
 *   DS_CDB_USERNAME           cluster username
 *   DS_CDB_PASSWORD           cluster password
 *   DS_CDB_BUCKET             bucket name
 */
export async function connectDb(): Promise<void> {
  const connStr = process.env.DS_CDB_CONNECTION_STRING ?? "";
  const bucketName = process.env.DS_CDB_BUCKET ?? "";
  const cluster = await connect(connStr, {
    username: process.env.DS_CDB_USERNAME!,
    password: process.env.DS_CDB_PASSWORD!,
  });
  const bucket = cluster.bucket(bucketName);
  const scope = bucket.defaultScope();
  db = {
    cluster,
    bucket,
    scope,
    items: scope.collection("items"),
  };
}

/**
 * Returns the initialised DB handle.
 * Throws if connectDb() has not been called yet.
 */
export function getDb(): Db {
  if (!db) throw new Error("Database not initialised — call connectDb() first");
  return db;
}
