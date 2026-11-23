export const CREATE_GRAPHQL_SDK_HELP = `@corpdk/create-graphql-sdk — scaffold and upgrade GraphQL client SDK packages

Usage:
  create-graphql-sdk <init|sync|codegen|generate|upgrade> [directory] [options]

Commands:
  init       Scaffold an SDK package (empty directory only)
  sync       Merge schema sources into schema/schema.graphqls
  codegen    Regenerate src/generated/** from the committed snapshot
  generate   sync then codegen
  upgrade    Merge canonical template deltas; never overwrites schema/** or src/extensions/**

Options (init):
  --name <pkg>              npm package name (required unless --demo-schema)
  --schema <path>           Schema file, directory, glob, or typeDefs module (repeatable)
  --demo-schema             Use the engine starter SDL
  --scalar-preset <name>    Write scalar preset into sdk.config.yaml (v1: dal)
  --defer-sync              Skip sync and codegen during init
  --no-install              Skip pnpm install during init
  --dry-run                 Print planned writes only (init, upgrade)

Options (sync, generate):
  --check                   Compare snapshot only; exit 1 on drift
  --fail-on-breaking        Exit 1 on breaking schema changes

Options (upgrade):
  --dry-run                 Print planned writes only

Global:
  --version                 Show create-graphql-sdk version
  -h, --help                Show this help

Examples:
  create-graphql-sdk init ./packages/my-sdk --name @myorg/my-sdk --schema ../ds/src/generated/generated-schema.ts
  create-graphql-sdk sync ./packages/my-sdk --check
  create-graphql-sdk upgrade ./packages/my-sdk
`;

export type ParsedCli =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "usage"; message: string }
  | {
      kind: "init";
      dir: string;
      name: string;
      schema: string[];
      demoSchema: boolean;
      scalarPreset?: "dal";
      deferSync: boolean;
      dryRun: boolean;
      noInstall: boolean;
    }
  | {
      kind: "sync";
      dir: string;
      check: boolean;
      failOnBreaking: boolean;
    }
  | { kind: "codegen"; dir: string }
  | {
      kind: "generate";
      dir: string;
      check: boolean;
      failOnBreaking: boolean;
    }
  | { kind: "upgrade"; dir: string; dryRun: boolean };