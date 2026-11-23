import type { RuntimeConfig } from "./types.js";

export function emitRuntimeConfigModule(config: RuntimeConfig): string {
  const lines = [
    "// @generated — do not edit manually",
    'import type { RuntimeConfig } from "@corpdk/graphql-cli-core/codegen";',
    "",
    `export const runtimeConfig = ${JSON.stringify(config, null, 2)} as const satisfies RuntimeConfig;`,
    "",
  ];
  return lines.join("\n");
}