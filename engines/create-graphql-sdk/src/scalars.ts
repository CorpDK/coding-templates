import { GraphQLScalarType, isScalarType, type GraphQLSchema } from "graphql";
import type {
  ScalarConfigEntry,
  ScalarZodConfig,
  SdkConfig,
} from "./sdk-config.js";

const SPEC_BUILTIN = new Set(["String", "Int", "Float", "Boolean", "ID"]);

export function listCustomScalars(schema: GraphQLSchema): string[] {
  const names: string[] = [];
  for (const type of Object.values(schema.getTypeMap())) {
    if (type instanceof GraphQLScalarType && !type.name.startsWith("__")) {
      if (!SPEC_BUILTIN.has(type.name)) {
        names.push(type.name);
      }
    } else if (isScalarType(type) && !SPEC_BUILTIN.has(type.name)) {
      if (!type.name.startsWith("__")) names.push(type.name);
    }
  }
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export function stubScalarEntry(name: string): ScalarConfigEntry {
  return {
    type: "string",
    zod: "z.string() /* TODO: review unmapped scalar */",
    wire: "string",
  };
}

export function mergeScalarStubs(
  config: SdkConfig,
  unmapped: string[],
): SdkConfig {
  if (unmapped.length === 0) return config;
  const scalars = config.scalars ? { ...config.scalars } : {};
  for (const name of unmapped) {
    if (!scalars[name]) {
      scalars[name] = stubScalarEntry(name);
    }
  }
  return { ...config, scalars };
}

function zodRefImport(zod: ScalarZodConfig): string | null {
  if (typeof zod === "string") return null;
  return `import { ${zod.name} } from "${zod.from}";`;
}

export function buildScalarRegistrySource(
  config: SdkConfig,
  schemaScalarNames?: readonly string[],
): { source: string; scalarNames: string[] } {
  const entries = config.scalars ?? {};
  const names =
    schemaScalarNames === undefined
      ? Object.keys(entries)
      : [...new Set(schemaScalarNames)]
          .filter((name) => entries[name] != null)
          .sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    return {
      source: `export const scalarZodSchemas = {} as const;
export type ScalarZodSchemaName = keyof typeof scalarZodSchemas;

export const scalarWireFormats = {} as const;
`,
      scalarNames: [],
    };
  }

  const importLines = new Set<string>();
  const schemaLines: string[] = [];
  const wireLines: string[] = [];

  for (const name of names) {
    const entry = entries[name]!;
    const wire = entry.wire ?? "string";
    wireLines.push(`  ${name}: "${wire}",`);

    if (typeof entry.zod === "string") {
      schemaLines.push(`  ${name}: ${entry.zod},`);
    } else {
      const imp = zodRefImport(entry.zod);
      if (imp) importLines.add(imp);
      schemaLines.push(`  ${name}: ${entry.zod.name},`);
    }
  }

  const header = `import { z } from "zod";\n${[...importLines].join("\n")}\n`;
  const body = `${header}
export const scalarZodSchemas = {
${schemaLines.join("\n")}
} as const;
export type ScalarZodSchemaName = keyof typeof scalarZodSchemas;

export const scalarWireFormats = {
${wireLines.join("\n")}
} as const;
`;

  return { source: body, scalarNames: names };
}

/** Keys for graphql-input-zod emitter (registry mode). Values are placeholders. */
export function scalarEmitterMap(
  config: SdkConfig,
  customNames: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of customNames) {
    const entry = config.scalars?.[name];
    if (typeof entry?.zod === "string") {
      out[name] = entry.zod;
    } else {
      out[name] = "z.unknown()";
    }
  }
  return out;
}

export function l1ScalarMap(
  config: SdkConfig,
  customNames: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of customNames) {
    out[name] = config.scalars?.[name]?.type ?? "string";
  }
  return out;
}

export function customLeafScalars(config: SdkConfig): string[] {
  const out: string[] = [];
  for (const [name, entry] of Object.entries(config.scalars ?? {})) {
    const t = entry.type.trim();
    if (t.includes("{") || t.startsWith("Record<")) {
      out.push(name);
    }
  }
  return out;
}
