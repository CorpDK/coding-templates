import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));

export const CREATE_GRAPHQL_CLI_ENGINE_ROOT = path.resolve(DIR, "..");

export const ENGINE_VERSION_FILE = ".create-graphql-cli-version";

export const CREATE_GRAPHQL_CLI_HELP = `create-graphql-cli <init|generate|upgrade> [directory] [options]

  init [dir]          Scaffold a GraphQL automation CLI package
  generate [dir]      Regenerate src/generated from the SDK snapshot
  upgrade [dir]       Refresh canonical binding files

  init options:
    --sdk <path>          SDK package directory (required)
    --name <pkg>          npm package name (required)
    --bin <name>          executable name (default: last segment of --name)
    --defer-generate      Skip install and generate on init
    --no-install          Skip pnpm install on init
    --dry-run             Print planned writes only

  generate options:
    --check               Exit 1 if generated output would change

  Common:
    --version             Print engine version
    -h, --help            Show this help
`;