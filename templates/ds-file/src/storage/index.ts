import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { ItemSchema, type Item } from "./schemas.js";

type FileFormat = "json" | "yaml";

let dataDir = "./data";
let format: FileFormat = "json";

function itemsFilePath(): string {
  return join(dataDir, `items.${format}`);
}

/**
 * Reads DS_FILE_DATA_DIR and DS_FILE_FORMAT from env, creates the data
 * directory if it does not exist.
 * Must be called once at server startup.
 */
export async function initStorage(): Promise<void> {
  dataDir = process.env.DS_FILE_DATA_DIR ?? "./data";
  const rawFormat = process.env.DS_FILE_FORMAT ?? "json";
  if (rawFormat !== "json" && rawFormat !== "yaml") {
    throw new Error(`DS_FILE_FORMAT must be "json" or "yaml", got: ${rawFormat}`);
  }
  format = rawFormat;
  await mkdir(dataDir, { recursive: true });
}

/**
 * Reads all items from the data file.
 * Returns an empty array if the file does not exist yet.
 */
export async function getItems(): Promise<Item[]> {
  const filePath = itemsFilePath();
  if (!existsSync(filePath)) return [];
  const raw = await readFile(filePath, "utf-8");
  const parsed = format === "yaml" ? yaml.load(raw) : JSON.parse(raw);
  return (parsed as unknown[]).map((row) => ItemSchema.parse(row));
}

/**
 * Writes the items array to the data file atomically via a temp file + rename.
 * Prevents partial writes from corrupting the data file.
 */
export async function saveItems(items: Item[]): Promise<void> {
  const filePath = itemsFilePath();
  const tmpPath = `${filePath}.tmp`;
  const content =
    format === "yaml"
      ? yaml.dump(items, { indent: 2 })
      : JSON.stringify(items, null, 2);
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, filePath);
}
