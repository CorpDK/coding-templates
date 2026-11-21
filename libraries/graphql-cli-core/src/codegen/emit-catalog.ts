import type { CommandDescriptor } from "./types.js";

export function emitCommandsModule(commands: CommandDescriptor[]): string {
  const lines: string[] = [
    "// @generated — do not edit manually",
  ];
  lines.push(
    'import type { CommandDescriptor } from "@corpdk/graphql-cli-core/codegen";',
    "",
    `export const catalog: Record<string, CommandDescriptor> = {`,
  );

  for (const cmd of commands) {
    lines.push(
      `  ${JSON.stringify(cmd.command)}: ${JSON.stringify(cmd, null, 2).replaceAll("\n", "\n  ")},`,
    );
  }

  lines.push("};", "");
  return lines.join("\n");
}

import type { ExtractedOperation } from "./types.js";

export function toCommandDescriptors(
  ops: ExtractedOperation[],
): CommandDescriptor[] {
  return ops.map((op) => ({
    command: op.command,
    kind: op.kind,
    field: op.field,
    description: op.description,
    deprecated: op.deprecated,
    destructive: op.destructive,
    paginated: op.paginated,
    followUps: op.followUps,
    args: op.args,
    selection: op.selection,
  }));
}