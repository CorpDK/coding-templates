import path from "node:path";
import { checkCanonical } from "@corpdk/engine-kit";
import { CANONICAL_EXCLUDE, CREATE_DS_ENGINE_ROOT } from "../constants.js";

const repoRoot = path.resolve(CREATE_DS_ENGINE_ROOT, "..", "..");
const from = path.join(repoRoot, "templates", "ds");
const to = path.join(CREATE_DS_ENGINE_ROOT, "canonical");

const result = await checkCanonical({
  from,
  to,
  exclude: [...CANONICAL_EXCLUDE],
});

if (!result.ok) {
  for (const line of result.mismatches) {
    console.error(line);
  }
  process.exit(1);
}

console.log(
  "Canonical drift check OK (templates/ds ⇄ engines/create-ds/canonical).",
);
