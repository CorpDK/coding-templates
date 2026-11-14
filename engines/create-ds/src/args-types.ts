export const CREATE_DS_HELP = `@corpdk/create-ds — scaffold and upgrade DAL-automated DS packages

Usage:
  create-ds init [directory] [options]
  create-ds upgrade [directory] [options]

Commands:
  init      Scaffold a minimal DS package (Drizzle schema + dal.config + scripts)
  upgrade   Merge canonical template deltas; never overwrites src/db/schema/**

Options (init):
  --name <pkg>       npm package name (default: @corpdk/ds)
  --demo-schema      Copy full demo commerce schema + seed from canonical
  --dry-run          Print planned writes only
  --no-install       Omit pnpm install from printed next steps (init never installs)

Options (upgrade):
  --dry-run          Print planned writes only

Global:
  --version          Show create-ds version
  -h, --help         Show this help

Examples:
  create-ds init ./packages/my-ds --name @myorg/my-ds
  create-ds upgrade ./packages/my-ds
  create-ds upgrade   # upgrades current working directory
`;

export type ParsedCli =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "usage"; message: string }
  | {
      kind: "init";
      dir: string;
      name: string;
      demoSchema: boolean;
      dryRun: boolean;
      noInstall: boolean;
    }
  | { kind: "upgrade"; dir: string; dryRun: boolean };