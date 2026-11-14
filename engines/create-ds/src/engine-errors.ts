import { YAMLParseError } from "yaml";
import { EXIT_TOOL, EXIT_VALIDATION } from "@corpdk/engine-kit";

export function exitCodeForEngineError(
  err: unknown,
): typeof EXIT_VALIDATION | typeof EXIT_TOOL {
  if (err instanceof SyntaxError) return EXIT_VALIDATION;
  if (err instanceof YAMLParseError) return EXIT_VALIDATION;
  if (err instanceof Error && err.name === "YAMLParseError") {
    return EXIT_VALIDATION;
  }
  return EXIT_TOOL;
}
