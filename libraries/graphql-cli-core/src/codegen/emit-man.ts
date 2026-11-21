import type { CommandDescriptor } from "./types.js";

function groffEscape(s: string): string {
  return s
    .replaceAll("\\", String.raw`\\`)
    .replaceAll('"', String.raw`\(dq`)
    .replaceAll("-", String.raw`\-`);
}

function fmtSynopsis(commands: CommandDescriptor[]): string {
  return commands
    .map((op) => {
      const args = op.args
        .map((a) =>
          a.required
            ? String.raw`\fB\-\-${a.flag}\fP \fI${a.graphqlType}\fP`
            : String.raw`[\fB\-\-${a.flag}\fP \fI${a.graphqlType}\fP]`,
        )
        .join(" ");
      return `.TP\n.B ${groffEscape(op.command)}${args ? "\n" + args : ""}`;
    })
    .join("\n");
}

function fmtCommandSection(
  commands: CommandDescriptor[],
  heading: string,
): string {
  if (commands.length === 0) return "";

  const items = commands
    .map((op) => {
      const argLines = op.args
        .map((a) => {
          const required = a.required ? " (required)" : " (optional)";
          const flag = String.raw`\fB\-\-${a.flag}\fP \fI${a.graphqlType}\fP`;
          const desc = groffEscape(a.description || "No description.");
          return `.RS\n${flag}${required}\n.br\n${desc}\n.RE`;
        })
        .join("\n");

      return (
        `.TP\n.B ${groffEscape(op.command)}\n` +
        `${groffEscape(op.description || "No description.")}\n` +
        (argLines ? argLines + "\n" : "")
      );
    })
    .join("\n");

  return `.SH ${heading}\n${items}`;
}

export interface EmitManOptions {
  bin: string;
  version?: string;
  httpUrlEnv?: string;
  defaultUrl?: string;
}

export function emitMan(
  commands: CommandDescriptor[],
  options: EmitManOptions,
): string {
  const {
    bin,
    version = "0.0.0",
    httpUrlEnv = "GRAPHQL_HTTP_URL",
    defaultUrl = "http://localhost:4000/graphql",
  } = options;

  const today = new Date().toISOString().split("T")[0];
  const queries = commands.filter((o) => o.kind === "query");
  const mutations = commands.filter((o) => o.kind === "mutation");
  const subs = commands.filter((o) => o.kind === "subscription");
  const binGroff = groffEscape(bin);

  return [
    String.raw`.TH ${binGroff.toUpperCase()} 1 "${today}" "${bin} ${version}" "User Commands"`,
    "",
    ".SH NAME",
    `${binGroff} \\- Auto\\-generated CLI for a GraphQL API`,
    "",
    ".SH SYNOPSIS",
    String.raw`.B ${binGroff}`,
    ".I command",
    "[options]",
    "",
    ".SH DESCRIPTION",
    "Interact with a GraphQL API from the command line.",
    String.raw`All commands output newline\-delimited JSON on stdout.`,
    "Operational errors are written to stderr as JSON.",
    ".PP",
    String.raw`Variables can be supplied as command\-line flags, via`,
    String.raw`.B \-\-vars\-file`,
    "file, or piped as JSON on stdin.",
    "Explicit flags override file and stdin values.",
    "",
    ".SH SYNOPSIS (commands)",
    fmtSynopsis(commands),
    "",
    fmtCommandSection(queries, "QUERIES"),
    "",
    fmtCommandSection(mutations, "MUTATIONS"),
    "",
    fmtCommandSection(subs, "SUBSCRIPTIONS"),
    "",
    ".SH INPUT",
    ".TP",
    String.raw`.B \-\-vars\-file <file.json>`,
    "Read variables from a JSON file.",
    ".TP",
    ".B (stdin)",
    "When stdin is not a TTY, read variables JSON from the pipe.",
    ".PP",
    String.raw`Merge order: \-\-vars\-file < piped stdin < explicit flags.`,
    "",
    ".SH SUBSCRIPTION OPTIONS",
    ".TP",
    String.raw`.B \-\-max\-events N`,
    "Exit after receiving N events.",
    ".TP",
    String.raw`.B \-\-timeout\-ms N`,
    "Exit after N milliseconds regardless of received events.",
    "",
    ".SH ENVIRONMENT",
    ".TP",
    `.B ${httpUrlEnv}`,
    `GraphQL HTTP endpoint (queries, mutations, subscriptions over SSE). Default: ${defaultUrl}`,
    "",
    ".SH EXIT STATUS",
    ".TP",
    ".B 0",
    "Success.",
    ".TP",
    ".B 1",
    "GraphQL errors in the response.",
    ".TP",
    ".B 2",
    "Usage error.",
    ".TP",
    ".B 3",
    "Validation error (no request sent).",
    ".TP",
    ".B 4",
    "Transport error.",
    ".TP",
    ".B 5",
    "Mutation payload userErrors.",
    "",
    ".SH NOTES",
    "Requires Node.js 24+.",
    String.raw`This file is auto\-generated.`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}