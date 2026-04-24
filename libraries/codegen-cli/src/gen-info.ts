import type { OperationDescriptor } from "./schema-utils.js";

/** Escape Texinfo special characters. */
function texEscape(s: string): string {
  return s.replace(/@/g, "@@").replace(/\{/g, "@{").replace(/\}/g, "@}");
}

function fmtArgsTable(args: OperationDescriptor["args"]): string {
  if (args.length === 0) return "No arguments.\n";

  const rows = args.map((a) => {
    const req = a.required ? "(required)" : "(optional)";
    return `@item @code{--${texEscape(a.name)}} @var{${texEscape(a.graphqlType)}} ${req}\n${texEscape(a.description || "No description.")}`;
  });

  return `@table @asis\n${rows.join("\n")}\n@end table\n`;
}

function fmtCommandsSection(
  ops: OperationDescriptor[],
  title: string,
  extraNote?: string,
): string {
  if (ops.length === 0) return "";

  const items = ops
    .map((op) => {
      const usage = [
        op.commandName,
        ...op.args.map((a) =>
          a.required
            ? `--${a.name} <${a.graphqlType}>`
            : `[--${a.name} <${a.graphqlType}>]`,
        ),
      ].join(" ");
      return (
        `@subsection ${texEscape(op.commandName)}\n` +
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

export function generateInfo(ops: OperationDescriptor[]): string {
  const queries = ops.filter((o) => o.operationType === "query");
  const mutations = ops.filter((o) => o.operationType === "mutation");
  const subs = ops.filter((o) => o.operationType === "subscription");

  const today = new Date().toISOString().split("T")[0];

  return [
    "\\input texinfo",
    "@c @generated — do not edit manually",
    `@c Generated: ${today}`,
    "@c Compile with: makeinfo ds-cli.texi",
    "",
    "@settitle ds-cli",
    "@documentencoding UTF-8",
    "",
    "@copying",
    "This manual documents ds-cli, the auto-generated GraphQL CLI.",
    "",
    "Copyright @copyright{} the project authors.",
    "@end copying",
    "",
    "@titlepage",
    "@title ds-cli",
    "@subtitle Auto-generated CLI for the GraphQL data service",
    "@page",
    "@insertcopying",
    "@end titlepage",
    "",
    "@ifnottex",
    "@node Top",
    "@top ds-cli",
    "@insertcopying",
    "@end ifnottex",
    "",
    "@menu",
    "* Overview::      What ds-cli does",
    "* Commands::      All available commands",
    "* Input::         Supplying variables",
    "* Environment::   Configuration via environment variables",
    "* Requirements::  Node.js version requirements",
    "@end menu",
    "",
    "@node Overview",
    "@chapter Overview",
    "",
    "ds-cli is an auto-generated command-line interface for the GraphQL data service.",
    "It is regenerated from the GraphQL schema whenever you run @code{pnpm codegen}",
    "in your DS package.",
    "",
    "All commands write newline-delimited JSON to stdout.",
    "Errors are written to stderr and the process exits with code 1.",
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
      "Subscriptions stream newline-delimited JSON until Ctrl-C, --count, or --timeout.",
    ),
    "",
    "@node Input",
    "@chapter Input",
    "",
    "Variables can be supplied three ways (merged in this order, later overrides earlier):",
    "",
    "@enumerate",
    "@item",
    "@code{--input <file.json>} — read from a JSON file.",
    "@item",
    "Piped stdin — when stdin is not a TTY, read JSON from the pipe.",
    "@item",
    "Explicit flags — @code{--name value} on the command line.",
    "@end enumerate",
    "",
    "For subscriptions, two extra options are available:",
    "@table @code",
    "@item --count N",
    "Exit after receiving N events.",
    "@item --timeout Ms",
    "Exit after Ms milliseconds.",
    "@end table",
    "",
    "@node Environment",
    "@chapter Environment",
    "",
    "@table @env",
    "@item DS_HTTP_URL",
    "GraphQL HTTP endpoint. Default: @code{http://localhost:4000/graphql}",
    "@item DS_WS_URL",
    "GraphQL WebSocket endpoint. Default: @code{ws://localhost:4000/graphql}",
    "@end table",
    "",
    "@node Requirements",
    "@chapter Requirements",
    "",
    "Requires Node.js 18 or later (for @code{fetch}).",
    "WebSocket subscriptions require Node.js 22 or later.",
    "",
    "@bye",
  ].join("\n");
}
