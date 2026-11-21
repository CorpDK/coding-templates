import type { CommandDescriptor } from "./types.js";

function texEscape(s: string): string {
  return s.replaceAll("@", "@@").replaceAll("{", "@{").replaceAll("}", "@}");
}

function fmtArgsTable(args: CommandDescriptor["args"]): string {
  if (args.length === 0) return "No arguments.\n";

  const rows = args.map((a) => {
    const req = a.required ? "(required)" : "(optional)";
    return `@item @code{--${texEscape(a.flag)}} @var{${texEscape(a.graphqlType)}} ${req}\n${texEscape(a.description || "No description.")}`;
  });

  return `@table @asis\n${rows.join("\n")}\n@end table\n`;
}

function fmtCommandsSection(
  commands: CommandDescriptor[],
  title: string,
  extraNote?: string,
): string {
  if (commands.length === 0) return "";

  const items = commands
    .map((op) => {
      const usage = [
        op.command,
        ...op.args.map((a) =>
          a.required
            ? `--${a.flag} <${a.graphqlType}>`
            : `[--${a.flag} <${a.graphqlType}>]`,
        ),
      ].join(" ");
      return (
        `@subsection ${texEscape(op.command)}\n` +
        `@example\n${texEscape(usage)}\n@end example\n\n` +
        `${texEscape(op.description || "No description.")}\n\n` +
        fmtArgsTable(op.args)
      );
    })
    .join("\n");

  return (
    `@section ${texEscape(title)}\n` +
    (extraNote ? `${texEscape(extraNote)}\n\n` : "") +
    items
  );
}

export interface EmitTexiOptions {
  bin: string;
  httpUrlEnv?: string;
  defaultUrl?: string;
}

export function emitTexi(
  commands: CommandDescriptor[],
  options: EmitTexiOptions,
): string {
  const {
    bin,
    httpUrlEnv = "GRAPHQL_HTTP_URL",
    defaultUrl = "http://localhost:4000/graphql",
  } = options;

  const queries = commands.filter((o) => o.kind === "query");
  const mutations = commands.filter((o) => o.kind === "mutation");
  const subs = commands.filter((o) => o.kind === "subscription");
  return [
    String.raw`\input texinfo`,
    "@c @generated — do not edit manually",
    `@c Compile with: makeinfo ${bin}.texi`,
    "",
    `@settitle ${texEscape(bin)}`,
    "@documentencoding UTF-8",
    "",
    "@copying",
    `This manual documents ${bin}, the auto-generated GraphQL CLI.`,
    "",
    "Copyright @copyright{} the project authors.",
    "@end copying",
    "",
    "@titlepage",
    `@title ${texEscape(bin)}`,
    "@subtitle Auto-generated CLI for a GraphQL API",
    "@page",
    "@insertcopying",
    "@end titlepage",
    "",
    "@ifnottex",
    "@node Top",
    `@top ${texEscape(bin)}`,
    "@insertcopying",
    "@end ifnottex",
    "",
    "@menu",
    "* Overview::      What the CLI does",
    "* Commands::      All available commands",
    "* Input::         Supplying variables",
    "* Environment::   Configuration via environment variables",
    "@end menu",
    "",
    "@node Overview",
    "@chapter Overview",
    "",
    `${texEscape(bin)} is an auto-generated command-line interface for a GraphQL API.`,
    "",
    "All commands write newline-delimited JSON to stdout.",
    "Errors are written to stderr as JSON.",
    "",
    "@node Commands",
    "@chapter Commands",
    "",
    fmtCommandsSection(queries, "Queries"),
    "",
    fmtCommandsSection(mutations, "Mutations"),
    "",
    fmtCommandsSection(
      subs,
      "Subscriptions",
      "Subscriptions stream newline-delimited JSON until stopped.",
    ),
    "",
    "@node Input",
    "@chapter Input",
    "",
    "Variables can be supplied three ways (merged in this order, later overrides earlier):",
    "",
    "@enumerate",
    "@item",
    "@code{--vars-file <file.json>} — read from a JSON file.",
    "@item",
    "Piped stdin — when stdin is not a TTY, read JSON from the pipe.",
    "@item",
    "Explicit flags — @code{--name value} on the command line.",
    "@end enumerate",
    "",
    "For subscriptions:",
    "@table @code",
    "@item --max-events N",
    "Exit after receiving N events.",
    "@item --timeout-ms N",
    "Exit after N milliseconds.",
    "@end table",
    "",
    "@node Environment",
    "@chapter Environment",
    "",
    "@table @env",
    `@item ${texEscape(httpUrlEnv)}`,
    `GraphQL HTTP endpoint (queries, mutations, subscriptions via SSE). Default: @code{${texEscape(defaultUrl)}}`,
    "@end table",
    "",
    "@bye",
  ].join("\n");
}
