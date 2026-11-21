import type { OperationKind } from "./types.js";

export function toKebabCase(name: string): string {
  return name
    .replaceAll(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");
}

export const RESERVED_COMMANDS = new Set([
  "commands",
  "describe",
  "interactive",
  "help",
  "version",
]);

export const RESERVED_FLAGS = new Set([
  "vars-file",
  "endpoint",
  "timeout-ms",
  "max-events",
  "all",
  "max-pages",
  "confirm",
  "interactive",
  "pretty",
  "raw",
  "help",
  "version",
  "h",
]);

const DEFAULT_DESTRUCTIVE = ["delete*", "bulkDelete*", "bulkUpdate*ByFilter"];

export function globMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, String.raw`\$&`);
  const re = new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
  return re.test(value);
}

export function isDestructiveMutation(
  fieldName: string,
  patterns: string[] = DEFAULT_DESTRUCTIVE,
): boolean {
  return patterns.some((p) => globMatch(p, fieldName));
}

export function resolveReservedArgFlag(
  argName: string,
  warnings: string[],
): string {
  const base = toKebabCase(argName);
  if (RESERVED_FLAGS.has(base)) {
    warnings.push(
      `Argument "${argName}" flag --${base} collides with a reserved global flag; emitted as --arg-${base}`,
    );
    return `arg-${base}`;
  }
  return base;
}

interface CommandNameInput {
  field: string;
  kind: OperationKind;
}

/**
 * Resolve kebab-case command names with cross-root collisions and reserved names.
 */
export function resolveCommandNames(
  ops: CommandNameInput[],
  warnings: string[],
): Map<string, string> {
  const byField = new Map<string, CommandNameInput[]>();
  for (const op of ops) {
    const list = byField.get(op.field) ?? [];
    list.push(op);
    byField.set(op.field, list);
  }

  const result = new Map<string, string>();

  for (const [field, group] of byField) {
    const kebab = toKebabCase(field);
    const kinds = new Set(group.map((g) => g.kind));

    const assign = (kind: OperationKind, cmd: string) => {
      result.set(`${kind}:${field}`, cmd);
    };

    if (group.length === 1) {
      assign(
        group[0].kind,
        guardReserved(kebab, group[0].kind, field, warnings),
      );
      continue;
    }

    if (kinds.size > 1) {
      warnings.push(
        `Command name collision for field "${field}" across root types; applying kind prefixes`,
      );
      for (const g of group) {
        if (g.kind === "query") {
          assign(g.kind, guardReserved(kebab, g.kind, field, warnings));
        } else if (g.kind === "mutation") {
          assign(
            g.kind,
            guardReserved(`mutate-${kebab}`, g.kind, field, warnings),
          );
        } else {
          assign(
            g.kind,
            guardReserved(`subscribe-${kebab}`, g.kind, field, warnings),
          );
        }
      }
      continue;
    }

    for (const g of group) {
      assign(g.kind, guardReserved(kebab, g.kind, field, warnings));
    }
  }

  return result;
}

function guardReserved(
  cmd: string,
  kind: OperationKind,
  field: string,
  warnings: string[],
): string {
  if (!RESERVED_COMMANDS.has(cmd)) return cmd;
  const prefixed =
    kind === "query"
      ? `query-${cmd}`
      : kind === "mutation"
        ? `mutate-${cmd}`
        : `subscribe-${cmd}`;
  warnings.push(
    `Command "${cmd}" is reserved; renamed to "${prefixed}" for ${kind} field "${field}"`,
  );
  return prefixed;
}

export function operationKey(kind: OperationKind, field: string): string {
  return `${kind}:${field}`;
}
