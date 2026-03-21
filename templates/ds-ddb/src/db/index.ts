import { MongoClient, type Db as MongoDb, type Collection } from "mongodb";

/** Document shape stored in the items collection. Uses UUID string as _id. */
interface ItemDoc {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

interface Db {
  client: MongoClient;
  db: MongoDb;
  /** Collection for Item documents. */
  items: Collection<ItemDoc>;
}

let db: Db | null = null;

/**
 * Establishes the DocumentDB connection.
 * Must be called once at server startup before any resolver accesses the DB.
 *
 * DocumentDB (documentdb.io) exposes a MongoDB-compatible wire protocol,
 * so the standard mongodb driver is used to connect.
 *
 * Required env vars:
 *   DS_DDB_URL      e.g. mongodb://localhost:27017
 *   DS_DDB_DB_NAME  database name
 */
export async function connectDb(): Promise<void> {
  const url = process.env.DS_DDB_URL ?? "";
  const dbName = process.env.DS_DDB_DB_NAME ?? "";
  const client = new MongoClient(url);
  await client.connect();
  const mongoDb = client.db(dbName);
  db = {
    client,
    db: mongoDb,
    items: mongoDb.collection<ItemDoc>("items"),
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
