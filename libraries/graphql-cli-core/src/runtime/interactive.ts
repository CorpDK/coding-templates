import type {
  ArgDescriptor,
  CommandDescriptor,
  RuntimeConfig,
} from "../codegen/types.js";
import { baseGraphqlType, displayFlag } from "./arg-meta.js";
import type { Catalog } from "./catalog.js";
import { coerceFlagValue } from "./coerce.js";
import { UsageError } from "./errors.js";
import { EXIT_OK } from "./exit-codes.js";
import { isDestructive } from "./guard.js";
import type {
  ArgVariables,
  PromptsModule,
  SdkValidationBindings,
} from "./types.js";
import { validateVariables } from "./validate.js";

export interface InteractiveHost {
  bin: string;
  catalog: Catalog;
  config: RuntimeConfig;
  validation: SdkValidationBindings;
  prompts: PromptsModule;
  /** Runs validated variables through the same runtime as non-interactive mode. */
  run(op: CommandDescriptor, variables: ArgVariables): Promise<number>;
}

const SKIP = "__skip__";

type Answer<T> = { cancelled: true } | { cancelled: false; value: T };

async function ask<T>(
  prompts: PromptsModule,
  promise: Promise<T | symbol>,
): Promise<Answer<T>> {
  const value = await promise;
  if (prompts.isCancel(value)) {
    prompts.cancel("Cancelled");
    return { cancelled: true };
  }
  return { cancelled: false, value: value as T };
}

function checkText(arg: ArgDescriptor, text: string): string | undefined {
  try {
    coerceFlagValue(text, arg);
    return undefined;
  } catch (error) {
    return error instanceof UsageError ? error.message : String(error);
  }
}

async function promptEnum(
  prompts: PromptsModule,
  arg: ArgDescriptor,
): Promise<Answer<unknown>> {
  const options = [
    ...(arg.required ? [] : [{ value: SKIP, label: "(skip)" }]),
    ...(arg.enumValues ?? []).map((value) => ({ value, label: value })),
  ];
  const answer = await ask<string>(
    prompts,
    prompts.select({ message: displayFlag(arg), options }),
  );
  if (answer.cancelled) return answer;
  return {
    cancelled: false,
    value: answer.value === SKIP ? undefined : answer.value,
  };
}

async function promptBoolean(
  prompts: PromptsModule,
  arg: ArgDescriptor,
): Promise<Answer<unknown>> {
  const options = [
    { value: "true", label: "true" },
    { value: "false", label: "false" },
    ...(arg.required ? [] : [{ value: SKIP, label: "(skip)" }]),
  ];
  const answer = await ask<string>(
    prompts,
    prompts.select({ message: displayFlag(arg), options }),
  );
  if (answer.cancelled) return answer;
  return {
    cancelled: false,
    value: answer.value === SKIP ? undefined : answer.value === "true",
  };
}

async function promptText(
  prompts: PromptsModule,
  arg: ArgDescriptor,
): Promise<Answer<unknown>> {
  const hint =
    arg.kind === "input"
      ? "JSON object, or @file.json"
      : arg.list
        ? "JSON array or a single value"
        : arg.graphqlType;
  const answer = await ask<string>(
    prompts,
    prompts.text({
      message: `${displayFlag(arg)}${arg.required ? "" : " (optional)"}`,
      placeholder: hint,
      validate: (input) => {
        const text = input?.trim() ?? "";
        if (text === "") return arg.required ? "A value is required" : undefined;
        return checkText(arg, text);
      },
    }),
  );
  if (answer.cancelled) return answer;
  const text = answer.value.trim();
  return {
    cancelled: false,
    value: text === "" ? undefined : coerceFlagValue(text, arg),
  };
}

function promptArgument(
  prompts: PromptsModule,
  arg: ArgDescriptor,
): Promise<Answer<unknown>> {
  if (arg.kind === "enum" && !arg.list) return promptEnum(prompts, arg);
  if (
    arg.kind === "scalar" &&
    !arg.list &&
    baseGraphqlType(arg.graphqlType) === "Boolean"
  ) {
    return promptBoolean(prompts, arg);
  }
  return promptText(prompts, arg);
}

async function promptVariables(
  prompts: PromptsModule,
  op: CommandDescriptor,
): Promise<Answer<ArgVariables>> {
  const variables: ArgVariables = {};
  for (const arg of op.args) {
    const answer = await promptArgument(prompts, arg);
    if (answer.cancelled) return answer;
    if (answer.value !== undefined) variables[arg.name] = answer.value;
  }
  return { cancelled: false, value: variables };
}

async function pickCommand(
  host: InteractiveHost,
): Promise<Answer<CommandDescriptor>> {
  const commands = Object.values(host.catalog).sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) || a.command.localeCompare(b.command),
  );
  const answer = await ask<string>(
    host.prompts,
    host.prompts.autocomplete({
      message: "Pick a command",
      options: commands.map((cmd) => ({
        value: cmd.command,
        label: `${cmd.kind}: ${cmd.command}`,
        hint: cmd.description,
      })),
    }),
  );
  if (answer.cancelled) return answer;
  return { cancelled: false, value: host.catalog[answer.value]! };
}

/** Prompts until the SDK validators accept the answers, or the user gives up. */
async function collectValidated(
  host: InteractiveHost,
  op: CommandDescriptor,
): Promise<Answer<ArgVariables> | undefined> {
  for (;;) {
    const answered = await promptVariables(host.prompts, op);
    if (answered.cancelled) return answered;
    const result = validateVariables(op.args, answered.value, host.validation);
    if (result.ok) return { cancelled: false, value: result.variables };

    host.prompts.log.error(
      result.issues
        .map((issue) => `${issue.arg}${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`)
        .join("\n"),
    );
    const retry = await ask<boolean>(
      host.prompts,
      host.prompts.confirm({ message: "Fix the answers and try again?" }),
    );
    if (retry.cancelled || !retry.value) return undefined;
  }
}

async function confirmDestructive(
  host: InteractiveHost,
  op: CommandDescriptor,
  variables: ArgVariables,
): Promise<boolean> {
  host.prompts.note(
    `${op.command}\n${JSON.stringify(variables, null, 2)}`,
    "Destructive command",
  );
  const answer = await ask<boolean>(
    host.prompts,
    host.prompts.confirm({ message: `Run ${op.command}?`, initialValue: false }),
  );
  return !answer.cancelled && answer.value;
}

/**
 * Interactive mode (doc 14 §5): pick a command, answer type-aware prompts,
 * re-prompt on L3 validation issues, confirm destructive commands, run through
 * the shared runtime, and optionally repeat. Entered only on a TTY.
 */
export async function runInteractive(
  host: InteractiveHost,
  presetCommand?: CommandDescriptor,
): Promise<number> {
  const { prompts } = host;
  prompts.intro(host.bin);
  let code = EXIT_OK;
  let preset = presetCommand;

  for (;;) {
    let op = preset;
    preset = undefined;
    if (!op) {
      const picked = await pickCommand(host);
      if (picked.cancelled) return EXIT_OK;
      op = picked.value;
    }

    const collected = await collectValidated(host, op);
    if (collected === undefined || collected.cancelled) return code;

    const proceed =
      !isDestructive(op, host.config) ||
      (await confirmDestructive(host, op, collected.value));
    if (proceed) code = await host.run(op, collected.value);

    const again = await ask<boolean>(
      prompts,
      prompts.confirm({ message: "Run another command?", initialValue: false }),
    );
    if (again.cancelled || !again.value) break;
  }
  prompts.outro("Done");
  return code;
}
