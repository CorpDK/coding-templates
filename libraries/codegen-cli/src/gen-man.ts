import type { OperationDescriptor } from "./schema-utils.js";

/** Escape groff special characters in a plain-text string. */
function groffEscape(s: string): string {
  return s
    .replaceAll("\\", String.raw`\\`)
    .replaceAll('"', String.raw`\(dq`)
    .replaceAll("-", String.raw`\-`);
}

function fmtSynopsis(ops: OperationDescriptor[]): string {
  return ops
    .map((op) => {
      const args = op.args
        .map((a) =>
          a.required
            ? String.raw`\fB\-\-${a.name}\fP \fI${a.graphqlType}\fP`
            : String.raw`[\fB\-\-${a.name}\fP \fI${a.graphqlType}\fP]`,
        )
        .join(" ");
      return `.TP\n.B ${groffEscape(op.commandName)}${args ? "\n" + args : ""}`;
    })
    .join("\n");
}

function fmtCommandSection(
  ops: OperationDescriptor[],
  heading: string,
): string {
  if (ops.length === 0) return "";

  const items = ops
    .map((op) => {
      const argLines = op.args
        .map((a) => {
          const required = a.required ? " (required)" : " (optional)";
          const flag = String.raw`\fB\-\-${a.name}\fP \fI${a.graphqlType}\fP`;
          const desc = groffEscape(a.description || "No description.");
          return `.RS\n${flag}${required}\n.br\n${desc}\n.RE`;
        })
        .join("\n");

      return (
        `.TP\n.B ${groffEscape(op.commandName)}\n` +
        `${groffEscape(op.description || "No description.")}\n` +
        (argLines ? argLines + "\n" : "")
      );
    })
    .join("\n");

  return `.SH ${heading}\n${items}`;
}

export function generateMan(ops: OperationDescriptor[]): string {
  const today = new Date().toISOString().split("T")[0];

  const queries = ops.filter((o) => o.operationType === "query");
  const mutations = ops.filter((o) => o.operationType === "mutation");
  const subs = ops.filter((o) => o.operationType === "subscription");

  return [
    String.raw`.TH DS\-CLI 1 "${today}" "ds-cli 0.1.0" "User Commands"`,
    "",
    ".SH NAME",
    String.raw`ds\-cli \- Auto\-generated CLI for the GraphQL data service`,
    "",
    ".SH SYNOPSIS",
    String.raw`.B ds\-cli`,
    ".I command",
    "[options]",
    "",
    ".SH DESCRIPTION",
    "Interact with the GraphQL data service from the command line.",
    String.raw`All commands output newline\-delimited JSON on stdout.`,
    "Errors are written to stderr and the process exits with code 1.",
    ".PP",
    String.raw`Variables can be supplied as command\-line flags, via`,
    String.raw`.B \-\-input`,
    "file, or piped as JSON on stdin.",
    "Explicit flags override file and stdin values.",
    "",
    ".SH SYNOPSIS (commands)",
    fmtSynopsis(ops),
    "",
    fmtCommandSection(queries, "QUERIES"),
    "",
    fmtCommandSection(mutations, "MUTATIONS"),
    "",
    fmtCommandSection(subs, "SUBSCRIPTIONS"),
    "",
    ".SH INPUT",
    ".TP",
    String.raw`.B \-\-input <file.json>`,
    "Read variables from a JSON file.",
    ".TP",
    ".B (stdin)",
    "When stdin is not a TTY, read variables JSON from the pipe.",
    ".PP",
    String.raw`Merge order: \-\-input file < piped stdin < explicit flags.`,
    "",
    ".SH SUBSCRIPTION OPTIONS",
    ".TP",
    String.raw`.B \-\-count N`,
    "Exit after receiving N events.",
    ".TP",
    String.raw`.B \-\-timeout Ms`,
    "Exit after Ms milliseconds regardless of received events.",
    "",
    ".SH ENVIRONMENT",
    ".TP",
    ".B DS_HTTP_URL",
    "GraphQL HTTP endpoint. Default: http://localhost:4000/graphql",
    ".TP",
    ".B DS_WS_URL",
    "GraphQL WebSocket endpoint. Default: ws://localhost:4000/graphql",
    "",
    ".SH EXIT STATUS",
    ".TP",
    ".B 0",
    "Success.",
    ".TP",
    ".B 1",
    "GraphQL error, connection failure, or invalid arguments.",
    "",
    ".SH NOTES",
    "Requires Node.js 18+ (fetch) and Node.js 22+ (WebSocket).",
    String.raw`This file is auto\-generated. Run`,
    ".B pnpm codegen",
    "in your DS package to regenerate.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
