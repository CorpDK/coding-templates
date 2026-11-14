import path from "node:path";
import { syncCanonical } from "@corpdk/engine-kit";
import { CANONICAL_EXCLUDE, CREATE_DS_ENGINE_ROOT } from "../constants.js";

const repoRoot = path.resolve(CREATE_DS_ENGINE_ROOT, "..", "..");
const from = path.join(repoRoot, "templates", "ds");
const to = path.join(CREATE_DS_ENGINE_ROOT, "canonical");

await syncCanonical({
  from,
  to,
  exclude: [...CANONICAL_EXCLUDE],
});

console.log(`Synced canonical: ${from} → ${to}`);
