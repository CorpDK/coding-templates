import { outro } from "@clack/prompts";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runPrompts } from "./prompts.js";
import { scaffold } from "./scaffold.js";

// engines/create-app/dist/index.js → engines/create-app → engines → repo root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(__dirname, "..", "..", "..");

async function main(): Promise<void> {
  const config = await runPrompts();
  await scaffold(config, TEMPLATE_ROOT);

  const nextSteps: string[] = [
    `  cd ${config.outputDir}`,
    "  pnpm install",
  ];

  if (config.selectedPackages.size > 0) {
    if (!config.generateEnv) {
      nextSteps.push(
        "  # Copy .env.example → .env in each package and fill in values"
      );
    } else {
      nextSteps.push("  # Edit .env files in each package with your credentials");
    }

    if (config.projectType === "monorepo") {
      nextSteps.push(
        "  pnpm codegen   # Generate TypedDocumentNode SDK and resolver types"
      );
    }

    nextSteps.push("  pnpm dev       # Start all selected packages");
  }

  outro(
    `Done! Your project is ready at:\n  ${config.outputDir}\n\nNext steps:\n${nextSteps.join("\n")}`
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
