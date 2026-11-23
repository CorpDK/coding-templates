import { globMatch } from "../codegen/naming.js";
import type { CommandDescriptor, RuntimeConfig } from "../codegen/types.js";
import { UsageError } from "./errors.js";

/**
 * A mutation is destructive when the catalog says so or when its field matches
 * a `guard.destructive` pattern (covers a catalog generated with older config).
 */
export function isDestructive(
  op: CommandDescriptor,
  config: RuntimeConfig,
): boolean {
  if (op.kind !== "mutation") return false;
  return (
    op.destructive ||
    config.guard.destructive.some((pattern) => globMatch(pattern, op.field))
  );
}

/** Non-interactive seatbelt: destructive commands need `--confirm` (doc 14 §4.6). */
export function assertConfirmed(
  op: CommandDescriptor,
  config: RuntimeConfig,
  confirmed: boolean,
): void {
  if (isDestructive(op, config) && !confirmed) {
    throw new UsageError(
      `${op.command} is destructive; pass --confirm to run it non-interactively`,
    );
  }
}
