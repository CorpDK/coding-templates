import { outro } from "@clack/prompts";
import { parseArgs, printHelp } from "./args.js";
import { runInit } from "./init.js";
import { runUpgrade } from "./upgrade.js";
import { repoRootFromEngine } from "./template.js";

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  if (parsed.command === "help" || parsed.command === null) {
    printHelp();
    process.exit(parsed.command === "help" ? 0 : 1);
  }

  const repoRoot = repoRootFromEngine();

  if (parsed.command === "init") {
    await runInit({
      targetDir: parsed.targetDir,
      repoRoot,
      packageName: parsed.packageName,
      withDemoSchema: parsed.withDemoSchema,
    });

    outro(
      `DS package ready at:\n  ${parsed.targetDir}\n\nNext steps:\n` +
        `  cd ${parsed.targetDir}\n` +
        `  pnpm install\n` +
        `  pnpm dal:codegen\n`,
    );
    return;
  }

  if (parsed.command === "upgrade") {
    await runUpgrade({
      packageDir: parsed.targetDir,
      repoRoot,
    });

    outro(
      `Upgrade complete for:\n  ${parsed.targetDir}\n\nNext steps:\n` +
        `  pnpm install\n` +
        `  pnpm dal:codegen\n`,
    );
  }
}

try {
  await main();
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
