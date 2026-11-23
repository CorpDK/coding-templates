import type { GraphqlInputIssue } from "@corpdk/graphql-input-zod";
import type { ArgDescriptor } from "../codegen/types.js";
import { baseGraphqlType } from "./arg-meta.js";
import type { CliValidationIssue } from "./errors.js";
import { INT32_MAX, INT32_MIN } from "./coerce.js";
import type { ArgVariables, SdkValidationBindings } from "./types.js";

export type ValidateResult =
  | { ok: true; variables: ArgVariables }
  | { ok: false; issues: CliValidationIssue[] };

type ArgResult =
  | { ok: true; value: unknown }
  | { ok: false; issues: CliValidationIssue[] };

function issue(
  arg: ArgDescriptor,
  path: (string | number)[],
  message: string,
  code: string,
): CliValidationIssue {
  return { arg: arg.name, path, message, code };
}

function fromSdkIssues(
  arg: ArgDescriptor,
  issues: readonly GraphqlInputIssue[],
  prefix: (string | number)[] = [],
): CliValidationIssue[] {
  return issues.map((entry) =>
    issue(arg, [...prefix, ...entry.path], entry.message, entry.code),
  );
}

function scalarBuiltinProblem(
  base: string,
  value: unknown,
): { message: string; code: string } | undefined {
  switch (base) {
    case "Int":
      return typeof value === "number" &&
        Number.isInteger(value) &&
        value >= INT32_MIN &&
        value <= INT32_MAX
        ? undefined
        : { message: "Expected a 32-bit signed integer", code: "invalid_type" };
    case "Float":
      return typeof value === "number" && Number.isFinite(value)
        ? undefined
        : { message: "Expected a finite number", code: "invalid_type" };
    case "Boolean":
      return typeof value === "boolean"
        ? undefined
        : { message: "Expected a boolean", code: "invalid_type" };
    case "String":
      return typeof value === "string"
        ? undefined
        : { message: "Expected a string", code: "invalid_type" };
    case "ID":
      return typeof value === "string" || typeof value === "number"
        ? undefined
        : { message: "Expected a string or integer ID", code: "invalid_type" };
    default:
      return undefined;
  }
}

/** Checks one JSON value against a built-in scalar or enum (no SDK call). */
function builtinProblem(
  arg: ArgDescriptor,
  value: unknown,
): { message: string; code: string } | undefined {
  if (arg.kind === "enum") {
    return typeof value === "string" && arg.enumValues?.includes(value)
      ? undefined
      : {
          message: `Expected one of: ${arg.enumValues?.join(", ") ?? ""}`,
          code: "invalid_enum_value",
        };
  }
  return scalarBuiltinProblem(baseGraphqlType(arg.graphqlType), value);
}

function isBuiltinOrEnum(arg: ArgDescriptor): boolean {
  if (arg.kind === "enum") return true;
  return ["Int", "Float", "Boolean", "String", "ID"].includes(
    baseGraphqlType(arg.graphqlType),
  );
}

function validateBuiltin(arg: ArgDescriptor, value: unknown): ArgResult {
  if (arg.list) {
    if (!Array.isArray(value)) {
      return {
        ok: false,
        issues: [issue(arg, [], "Expected a list", "invalid_type")],
      };
    }
    const issues: CliValidationIssue[] = [];
    value.forEach((element, index) => {
      const problem = builtinProblem(arg, element);
      if (problem) issues.push(issue(arg, [index], problem.message, problem.code));
    });
    return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
  }
  const problem = builtinProblem(arg, value);
  return problem
    ? { ok: false, issues: [issue(arg, [], problem.message, problem.code)] }
    : { ok: true, value };
}

function validateInput(
  arg: ArgDescriptor,
  value: unknown,
  validation: SdkValidationBindings,
): ArgResult {
  const name = arg.inputZodSchemaName;
  if (!name) return { ok: true, value };
  let result;
  if (arg.list) {
    result = arg.required
      ? validation.safeParseGraphqlInputList(name, value)
      : validation.safeParseOptionalGraphqlInputList(name, value);
  } else {
    result = arg.required
      ? validation.safeParseGraphqlInput(name, value)
      : validation.safeParseOptionalGraphqlInput(name, value);
  }
  return result.ok
    ? { ok: true, value: result.data }
    : { ok: false, issues: fromSdkIssues(arg, result.issues) };
}

function validateCustomScalar(
  arg: ArgDescriptor,
  schemaName: string,
  value: unknown,
  validation: SdkValidationBindings,
): ArgResult {
  const values = arg.list ? value : [value];
  if (!Array.isArray(values)) {
    return {
      ok: false,
      issues: [issue(arg, [], "Expected a list", "invalid_type")],
    };
  }
  const parsed: unknown[] = [];
  const issues: CliValidationIssue[] = [];
  values.forEach((element, index) => {
    const prefix = arg.list ? [index] : [];
    if (element === null) {
      parsed.push(null);
      return;
    }
    const result = validation.safeParseGraphqlScalar(schemaName, element);
    if (result.ok) parsed.push(result.data);
    else issues.push(...fromSdkIssues(arg, result.issues, prefix));
  });
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: arg.list ? parsed : parsed[0] };
}

function validateArgument(
  arg: ArgDescriptor,
  value: unknown,
  validation: SdkValidationBindings,
): ArgResult {
  if (arg.kind === "input") return validateInput(arg, value, validation);
  if (value === null) {
    return arg.required
      ? {
          ok: false,
          issues: [issue(arg, [], "Expected a non-null value", "invalid_type")],
        }
      : { ok: true, value };
  }
  if (arg.scalarZodSchemaName && !isBuiltinOrEnum(arg)) {
    return validateCustomScalar(arg, arg.scalarZodSchemaName, value, validation);
  }
  if (isBuiltinOrEnum(arg)) return validateBuiltin(arg, value);
  return { ok: true, value };
}

/**
 * Pre-flight validation (doc 14 §3.5): input objects and custom scalars go
 * through the SDK's L3 helpers, built-ins and enums are checked locally. On
 * success the parsed values replace the raw ones. Nothing is sent on failure.
 */
export function validateVariables(
  args: readonly ArgDescriptor[],
  variables: ArgVariables,
  validation: SdkValidationBindings,
): ValidateResult {
  const parsed: ArgVariables = {};
  const issues: CliValidationIssue[] = [];

  for (const arg of args) {
    const value = variables[arg.name];
    if (value === undefined) {
      if (arg.required) {
        issues.push(issue(arg, [], "Required", "required"));
      }
      continue;
    }
    const result = validateArgument(arg, value, validation);
    if (result.ok) parsed[arg.name] = result.value;
    else issues.push(...result.issues);
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, variables: parsed };
}
