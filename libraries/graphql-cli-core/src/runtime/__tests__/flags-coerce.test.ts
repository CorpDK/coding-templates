import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ArgDescriptor } from "../../codegen/types.js";
import { coerceFlagValue } from "../coerce.js";
import { UsageError } from "../errors.js";
import { parseFlags } from "../flags.js";
import { fixtureCatalog } from "./fixture-sdk/catalog.js";

const items = fixtureCatalog.items!;
const item = fixtureCatalog.item!;

function arg(name: string, overrides: Partial<ArgDescriptor> = {}): ArgDescriptor {
  return {
    name,
    flag: name,
    graphqlType: "String",
    kind: "scalar",
    list: false,
    required: false,
    ...overrides,
  };
}

describe("parseFlags", () => {
  it("accepts `--flag value`, `--flag=value` and the camelCase alias", () => {
    const spaced = parseFlags(item, ["--id", "7", "--include-deleted"]);
    const inline = parseFlags(item, ["--id=7", "--includeDeleted"]);
    expect(spaced.argValues).toEqual({ id: "7", includeDeleted: true });
    expect(inline.argValues).toEqual(spaced.argValues);
  });

  it("supports bare, =false and --no- boolean forms", () => {
    expect(parseFlags(item, ["--include-deleted=false"]).argValues).toEqual({
      includeDeleted: false,
    });
    expect(parseFlags(item, ["--no-include-deleted"]).argValues).toEqual({
      includeDeleted: false,
    });
  });

  it("collects repeatable list flags in order", () => {
    const parsed = parseFlags(items, ["--ids", "a", "--ids", "b"]);
    expect(parsed.argValues.ids).toEqual(["a", "b"]);
  });

  it("takes a negative number as a value", () => {
    expect(parseFlags(items, ["--limit", "-5"]).argValues.limit).toBe("-5");
  });

  it("parses global flags separately from arguments", () => {
    const { globals, argValues } = parseFlags(items, [
      "--pretty",
      "--raw",
      "--timeout-ms",
      "250",
      "--endpoint=http://x/graphql",
      "-h",
    ]);
    expect(globals).toMatchObject({
      pretty: true,
      raw: true,
      timeoutMs: 250,
      endpoint: "http://x/graphql",
      help: true,
    });
    expect(argValues).toEqual({});
  });

  it.each([
    [["--nope"], "Unknown flag: --nope"],
    [["stray"], "Unexpected argument: stray"],
    [["--limit"], "Flag --limit requires a value"],
    [["--timeout-ms", "0"], "--timeout-ms must be a positive integer"],
    [["--max-events", "x"], "--max-events must be a positive integer"],
    [["--no-limit"], "Unknown flag: --no-limit"],
  ])("rejects %j", (argv, message) => {
    expect(() => parseFlags(items, argv)).toThrow(new UsageError(message));
  });
});

describe("coerceFlagValue (doc 14 §4.2)", () => {
  it("coerces Int within the 32-bit range and rejects the rest", () => {
    const int = arg("n", { graphqlType: "Int" });
    expect(coerceFlagValue("50", int)).toBe(50);
    expect(coerceFlagValue("-2147483648", int)).toBe(-2_147_483_648);
    for (const bad of ["2147483648", "1.5", "abc", "", "1e3"]) {
      expect(() => coerceFlagValue(bad, int)).toThrow(UsageError);
    }
  });

  it("coerces finite Floats only", () => {
    const float = arg("p", { graphqlType: "Float" });
    expect(coerceFlagValue("9.5", float)).toBe(9.5);
    for (const bad of ["Infinity", "NaN", "", "x"]) {
      expect(() => coerceFlagValue(bad, float)).toThrow(UsageError);
    }
  });

  it("coerces Booleans from text and bare flags", () => {
    const bool = arg("b", { graphqlType: "Boolean" });
    expect(coerceFlagValue(true, bool)).toBe(true);
    expect(coerceFlagValue("false", bool)).toBe(false);
    expect(() => coerceFlagValue("maybe", bool)).toThrow(UsageError);
  });

  it("checks enum membership and lists the allowed values", () => {
    const status = items.args.find((a) => a.name === "status")!;
    expect(coerceFlagValue("ACTIVE", status)).toBe("ACTIVE");
    expect(() => coerceFlagValue("GONE", status)).toThrow(
      /allowed: ACTIVE, ARCHIVED/,
    );
  });

  it("passes custom scalars as strings, or parses JSON for json-wire scalars", () => {
    const since = items.args.find((a) => a.name === "since")!;
    expect(coerceFlagValue("2026-01-01T00:00:00Z", since)).toBe(
      "2026-01-01T00:00:00Z",
    );
    const json = arg("meta", {
      graphqlType: "JSON",
      scalarWire: "json",
      scalarZodSchemaName: "JSON",
    });
    expect(coerceFlagValue('{"a":[1]}', json)).toEqual({ a: [1] });
    expect(() => coerceFlagValue("{", json)).toThrow(/Invalid JSON/);
  });

  it("coerces list elements from repeated flags or one JSON array", () => {
    const ints = arg("ns", { graphqlType: "[Int!]", list: true });
    expect(coerceFlagValue(["1", "2"], ints)).toEqual([1, 2]);
    expect(coerceFlagValue(["[3,4]"], ints)).toEqual([3, 4]);
    expect(() => coerceFlagValue(["[1,\"x\"]"], ints)).toThrow(UsageError);
    expect(() => coerceFlagValue(["[{}]"], ints)).toThrow(UsageError);
  });

  it("parses input objects from JSON text or @file", () => {
    const filter = items.args.find((a) => a.name === "filter")!;
    expect(coerceFlagValue('{"name":"x"}', filter)).toEqual({ name: "x" });

    const dir = mkdtempSync(join(tmpdir(), "cli-core-"));
    const file = join(dir, "filter.json");
    writeFileSync(file, '{"name":"from-file"}');
    expect(coerceFlagValue(`@${file}`, filter)).toEqual({ name: "from-file" });
    expect(() => coerceFlagValue(`@${join(dir, "missing.json")}`, filter)).toThrow(
      /Cannot read --filter file/,
    );
    expect(() => coerceFlagValue("{nope", filter)).toThrow(/Invalid JSON/);
  });

  it("builds lists of input objects from one array or repeated flags", () => {
    const inputs = fixtureCatalog["bulk-create-item"]!.args[0]!;
    expect(coerceFlagValue(['[{"name":"a"},{"name":"b"}]'], inputs)).toEqual([
      { name: "a" },
      { name: "b" },
    ]);
    expect(coerceFlagValue(['{"name":"a"}', '{"name":"b"}'], inputs)).toEqual([
      { name: "a" },
      { name: "b" },
    ]);
  });

  it("rejects a bare flag on a non-boolean argument", () => {
    expect(() => coerceFlagValue(true, arg("n", { graphqlType: "Int" }))).toThrow(
      /requires a value/,
    );
  });
});
