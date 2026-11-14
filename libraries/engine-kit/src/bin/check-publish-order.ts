#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkPublishOrder,
  DS_AUTOMATION_PACKAGE_JSON_PATH,
  DS_AUTOMATION_PUBLISH_ORDER,
  DS_AUTOMATION_TRUSTED_PACKAGES,
} from "../publish.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

const result = await checkPublishOrder({
  repoRoot,
  publishOrder: DS_AUTOMATION_PUBLISH_ORDER,
  packageJsonPath: (name) => DS_AUTOMATION_PACKAGE_JSON_PATH[name] ?? "",
  trustedPackages: DS_AUTOMATION_TRUSTED_PACKAGES,
  workflowFile: "publish-ds-automation.yml",
});

if (!result.ok) {
  for (const err of result.errors) {
    console.error(err);
  }
  process.exit(1);
}

console.log("Publish order guard OK (topological order matches PUBLISH_ORDER).");