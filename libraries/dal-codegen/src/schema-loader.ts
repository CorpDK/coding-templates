import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/** Register tsx so Drizzle schema `.ts` files resolve sibling `./foo.js` imports on Node 22+. */
let ready: Promise<void> | undefined;

export function ensureSchemaTypeScriptLoader(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const require = createRequire(import.meta.url);
      const tsxApiPath = require.resolve("tsx/esm/api");
      const { register } = await import(pathToFileURL(tsxApiPath).href);
      register();
    })();
  }
  return ready;
}
