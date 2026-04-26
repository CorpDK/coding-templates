import type { OperationDescriptor } from "./schema-utils.js";
import type { Config } from "./index.js";

// ---------------------------------------------------------------------------
// Serialise the OPERATIONS constant
// ---------------------------------------------------------------------------

function serializeOperations(ops: OperationDescriptor[]): string {
  const entries = ops.map((op) => {
    const argEntries = op.args.map(
      (a) =>
        `      ${JSON.stringify(a.name)}: ` +
        `{ parseType: "${a.parseType}", graphqlType: ${JSON.stringify(a.graphqlType)}, ` +
        `description: ${JSON.stringify(a.description)}, required: ${a.required} }`,
    );

    return (
      `  ${JSON.stringify(op.commandName)}: {\n` +
      `    operationType: "${op.operationType}",\n` +
      `    description: ${JSON.stringify(op.description)},\n` +
      // Backtick-delimited document string — GraphQL docs never contain backticks
      `    document: \`${op.document}\`,\n` +
      `    args: {\n` +
      (argEntries.length > 0 ? argEntries.join(",\n") + "\n" : "") +
      `    },\n` +
      `  }`
    );
  });

  return `const OPERATIONS = {\n${entries.join(",\n")}\n};`;
}

// ---------------------------------------------------------------------------
// Static runtime code (generated verbatim into index.js)
// ---------------------------------------------------------------------------
// Every line is a plain string so no escaping gymnastics are needed.

const RUNTIME_LINES = [
  "// ---------------------------------------------------------------------------",
  "// Runtime helpers",
  "// ---------------------------------------------------------------------------",
  "",
  "function printHelp(name) {",
  '  const queries      = Object.entries(OPERATIONS).filter(([,o]) => o.operationType === "query");',
  '  const mutations    = Object.entries(OPERATIONS).filter(([,o]) => o.operationType === "mutation");',
  '  const subs         = Object.entries(OPERATIONS).filter(([,o]) => o.operationType === "subscription");',
  "",
  "  function fmtArgs(args) {",
  "    return Object.entries(args).map(([n, a]) =>",
  '      a.required ? "--" + n + " <" + a.graphqlType + ">" : "[--" + n + " <" + a.graphqlType + ">]"',
  '    ).join(" ");',
  "  }",
  "",
  String.raw`  let h = "Usage: " + name + " <command> [options]\n\n";`,
  "",
  "  if (queries.length) {",
  String.raw`    h += "Queries:\n";`,
  "    for (const [cmd, op] of queries) {",
  "      const a = fmtArgs(op.args);",
  String.raw`      h += "  " + cmd + (a ? " " + a : "") + "\n";`,
  String.raw`      h += "    " + op.description + "\n";`,
  "    }",
  String.raw`    h += "\n";`,
  "  }",
  "",
  "  if (mutations.length) {",
  String.raw`    h += "Mutations:\n";`,
  "    for (const [cmd, op] of mutations) {",
  "      const a = fmtArgs(op.args);",
  String.raw`      h += "  " + cmd + (a ? " " + a : "") + "\n";`,
  String.raw`      h += "    " + op.description + "\n";`,
  "    }",
  String.raw`    h += "\n";`,
  "  }",
  "",
  "  if (subs.length) {",
  String.raw`    h += "Subscriptions (streams NDJSON until Ctrl-C or --count/--timeout):\n";`,
  "    for (const [cmd, op] of subs) {",
  String.raw`      h += "  " + cmd + " [--count N] [--timeout Ms]\n";`,
  String.raw`      h += "    " + op.description + "\n";`,
  "    }",
  String.raw`    h += "\n";`,
  "  }",
  "",
  String.raw`  h += "Input (mutations/queries with variables):\n";`,
  String.raw`  h += "  --input <file.json>  Read variables from JSON file\n";`,
  String.raw`  h += "  (stdin)              Pipe JSON when stdin is not a TTY\n";`,
  String.raw`  h += "  Merge order: --input file < piped stdin < explicit flags\n\n";`,
  "",
  String.raw`  h += "Output: newline-delimited JSON on stdout. Errors on stderr (exit 1).\n\n";`,
  "",
  String.raw`  h += "Environment:\n";`,
  String.raw`  h += "  DS_HTTP_URL  " + DS_HTTP_URL + "\n";`,
  String.raw`  h += "  DS_WS_URL    " + DS_WS_URL + "\n";`,
  "",
  "  process.stdout.write(h);",
  "}",
  "",
  "function coerceArg(value, graphqlType) {",
  String.raw`  const base = graphqlType.replace(/[!\[\]]/g, "");`,
  '  if (base === "Int")   return parseInt(value, 10);',
  '  if (base === "Float") return parseFloat(value);',
  "  return value;",
  "}",
  "",
  "async function executeHttp(document, variables) {",
  "  const body = JSON.stringify({ query: document, variables });",
  "  let res;",
  "  try {",
  "    res = await fetch(DS_HTTP_URL, {",
  '      method: "POST",',
  '      headers: { "Content-Type": "application/json", "Accept": "application/json" },',
  "      body,",
  "    });",
  "  } catch (err) {",
  String.raw`    process.stderr.write("Connection failed: " + err.message + "\n");`,
  "    process.exit(1);",
  "  }",
  "  const json = await res.json();",
  "  if (json.errors) {",
  String.raw`    process.stderr.write(JSON.stringify(json.errors, null, 2) + "\n");`,
  "    process.exit(1);",
  "  }",
  "  return json;",
  "}",
  "",
  "function executeSubscription(document, variables, opts) {",
  "  const { count, timeout } = opts;",
  "  return new Promise((resolve, reject) => {",
  "    let ws;",
  "    try {",
  '      ws = new WebSocket(DS_WS_URL, "graphql-transport-ws");',
  "    } catch (err) {",
  '      reject(new Error("WebSocket connection failed: " + err.message));',
  "      return;",
  "    }",
  "    let received = 0;",
  "    let done = false;",
  "",
  "    function finish() {",
  "      if (done) return;",
  "      done = true;",
  "      try { ws.close(); } catch (_) {}",
  "      resolve(undefined);",
  "    }",
  "",
  "    ws.onopen = () => {",
  '      ws.send(JSON.stringify({ type: "connection_init", payload: {} }));',
  "    };",
  "",
  "    ws.onmessage = (event) => {",
  "      let msg;",
  "      try { msg = JSON.parse(event.data); } catch { return; }",
  '      if (msg.type === "connection_ack") {',
  '        ws.send(JSON.stringify({ id: "1", type: "subscribe",',
  "          payload: { query: document, variables } }));",
  '      } else if (msg.type === "next") {',
  String.raw`        process.stdout.write(JSON.stringify(msg.payload) + "\n");`,
  "        received++;",
  "        if (count !== undefined && received >= count) finish();",
  '      } else if (msg.type === "error") {',
  String.raw`        process.stderr.write(JSON.stringify(msg.payload) + "\n");`,
  "        finish();",
  '      } else if (msg.type === "complete") {',
  "        finish();",
  "      }",
  "    };",
  "",
  "    ws.onerror = (err) => {",
  '      if (!done) reject(new Error("WebSocket error: " + err.message));',
  "    };",
  "    ws.onclose = () => { if (!done) finish(); };",
  "",
  "    if (timeout !== undefined) setTimeout(finish, timeout);",
  "",
  '    process.on("SIGINT",  finish);',
  '    process.on("SIGTERM", finish);',
  "  });",
  "}",
  "",
  "async function readInputVars(inputFile) {",
  "  let vars = {};",
  "  if (inputFile) {",
  "    try {",
  '      vars = JSON.parse(readFileSync(inputFile, "utf8"));',
  "    } catch (err) {",
  String.raw`      process.stderr.write("Failed to read --input file: " + err.message + "\n");`,
  "      process.exit(1);",
  "    }",
  "  }",
  "  if (!process.stdin.isTTY) {",
  "    const chunks = [];",
  "    for await (const chunk of process.stdin) chunks.push(chunk);",
  "    const raw = Buffer.concat(chunks).toString().trim();",
  "    if (raw) {",
  "      try { Object.assign(vars, JSON.parse(raw)); }",
  String.raw`      catch (err) { process.stderr.write("Invalid JSON on stdin: " + err.message + "\n"); process.exit(1); }`,
  "    }",
  "  }",
  "  return vars;",
  "}",
  "",
  "async function main() {",
  "  const argv = process.argv.slice(2);",
  "  const cmd  = argv[0];",
  '  const BIN  = basename(process.argv[1], ".js");',
  "",
  '  if (!cmd || cmd === "--help" || cmd === "-h") {',
  "    printHelp(BIN);",
  "    process.exit(0);",
  "  }",
  "",
  "  const op = OPERATIONS[cmd];",
  "  if (!op) {",
  String.raw`    process.stderr.write('Error: unknown command "' + cmd + '"\n\n');`,
  "    printHelp(BIN);",
  "    process.exit(1);",
  "  }",
  "",
  "  // Build parseArgs option map from operation args",
  '  const optionMap = { help: { type: "boolean", short: "h" }, input: { type: "string" } };',
  '  if (op.operationType === "subscription") {',
  '    optionMap["count"]   = { type: "string" };',
  '    optionMap["timeout"] = { type: "string" };',
  "  }",
  "  for (const [n, a] of Object.entries(op.args)) {",
  "    optionMap[n] = { type: a.parseType };",
  "  }",
  "",
  "  let values;",
  "  try {",
  "    ({ values } = parseArgs({ args: argv.slice(1), options: optionMap, allowPositionals: false }));",
  "  } catch (err) {",
  String.raw`    process.stderr.write("Error: " + err.message + "\n");`,
  "    process.exit(1);",
  "  }",
  "",
  '  if (values["help"]) {',
  '    let h = "Usage: " + BIN + " " + cmd;',
  "    for (const [n, a] of Object.entries(op.args)) {",
  '      h += a.required ? " --" + n + " <" + a.graphqlType + ">" : " [--" + n + " <" + a.graphqlType + ">]";',
  "    }",
  String.raw`    h += "\n\n" + op.description + "\n";`,
  "    process.stdout.write(h);",
  "    process.exit(0);",
  "  }",
  "",
  '  const baseVars = await readInputVars(values["input"]);',
  "  const variables = Object.assign({}, baseVars);",
  "",
  "  for (const [n, a] of Object.entries(op.args)) {",
  "    if (values[n] !== undefined) {",
  "      variables[n] = coerceArg(values[n], a.graphqlType);",
  "    }",
  "    if (a.required && variables[n] === undefined) {",
  String.raw`      process.stderr.write("Error: --" + n + " is required\n");`,
  "      process.exit(1);",
  "    }",
  "  }",
  "",
  '  if (op.operationType === "subscription") {',
  "    await executeSubscription(op.document, variables, {",
  '      count:   values["count"]   !== undefined ? parseInt(values["count"],   10) : undefined,',
  '      timeout: values["timeout"] !== undefined ? parseInt(values["timeout"], 10) : undefined,',
  "    });",
  "  } else {",
  "    const result = await executeHttp(op.document, variables);",
  String.raw`    process.stdout.write(JSON.stringify(result) + "\n");`,
  "  }",
  "}",
];

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function generateCli(
  ops: OperationDescriptor[],
  config: Config,
): string {
  const httpEnvVar = config.httpUrlEnvVar ?? "DS_HTTP_URL";
  const wsEnvVar = config.wsUrlEnvVar ?? "DS_WS_URL";

  const header = [
    "#!/usr/bin/env node",
    "// @generated — do not edit manually",
    "// Regenerate by running: pnpm codegen (in your DS package)",
    "// Requires Node 18+ (fetch) and Node 22+ (WebSocket)",
    "",
    'import { parseArgs } from "node:util";',
    'import { readFileSync } from "node:fs";',
    'import { basename } from "node:path";',
    "",
    `const DS_HTTP_URL = process.env.${httpEnvVar} ?? "http://localhost:4000/graphql";`,
    `const DS_WS_URL   = process.env.${wsEnvVar}   ?? "ws://localhost:4000/graphql";`,
    "",
  ].join("\n");

  const footer = [
    "",
    "main().catch((err) => {",
    String.raw`  process.stderr.write(err.message + "\n");`,
    "  process.exit(1);",
    "});",
  ].join("\n");

  return (
    header +
    serializeOperations(ops) +
    "\n\n" +
    RUNTIME_LINES.join("\n") +
    footer
  );
}
