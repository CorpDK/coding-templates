export interface ParsedArgs {
  command: "init" | "upgrade" | "help" | null;
  targetDir: string;
  packageName: string;
  withDemoSchema: boolean;
}

export function printHelp(): void {
  console.log(`@corpdk/create-ds — scaffold and upgrade DAL-automated DS packages

Usage:
  create-ds init [directory] [options]
  create-ds upgrade [directory] [options]

Commands:
  init      Scaffold a minimal DS package (Drizzle schema + dal.config + scripts)
  upgrade   Merge canonical template deltas; never overwrites src/db/schema/**

Options:
  --name <pkg>     npm package name (default: @corpdk/ds)
  --demo-schema    Copy full demo commerce schema + seed from templates/ds
  -h, --help       Show this help

Examples:
  create-ds init ./packages/my-ds --name @myorg/my-ds
  create-ds upgrade ./packages/my-ds
  create-ds upgrade   # upgrades current working directory
`);
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {
    command: null,
    targetDir: process.cwd(),
    packageName: "@corpdk/ds",
    withDemoSchema: false,
  };

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    result.command = "help";
    return result;
  }

  const cmd = args[0];
  if (cmd === "init" || cmd === "upgrade") {
    result.command = cmd;
  } else {
    result.command = "help";
    return result;
  }

  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--name" && args[i + 1]) {
      result.packageName = args[++i];
      i++;
      continue;
    }
    if (arg === "--demo-schema") {
      result.withDemoSchema = true;
      i++;
      continue;
    }
    if (!arg.startsWith("-")) {
      result.targetDir = arg;
      i++;
      continue;
    }
    i++;
  }

  return result;
}
