import { describe, expect, it, vi } from "vitest";
import { EXIT_SUCCESS, EXIT_USAGE, EXIT_TOOL } from "./types.js";
import { parseEngineCli, runEngineCli, type EngineCommandDef } from "./cli.js";

const commands: EngineCommandDef[] = [
  {
    name: "ping",
    handler: async () => ({
      exitCode: EXIT_SUCCESS,
      changedFiles: [],
    }),
  },
];

describe("parseEngineCli", () => {
  it("returns usage when argv is empty", () => {
    const parsed = parseEngineCli({
      name: "test-engine",
      version: "1.0.0",
      help: "help text",
      commands,
      argv: ["node", "test-engine"],
    });
    expect(parsed.kind).toBe("usage");
  });

  it("rejects unknown flags under strict parseArgs", () => {
    const parsed = parseEngineCli({
      name: "test-engine",
      version: "1.0.0",
      help: "help text",
      commands,
      argv: ["node", "test-engine", "ping", "--bogus"],
    });
    expect(parsed.kind).toBe("usage");
  });
});

describe("runEngineCli", () => {
  it("maps handler failure to tool exit", async () => {
    const failing: EngineCommandDef[] = [
      {
        name: "fail",
        handler: async () => {
          throw new Error("boom");
        },
      },
    ];
    const code = await runEngineCli({
      name: "test-engine",
      version: "1.0.0",
      help: "help",
      commands: failing,
      argv: ["node", "test-engine", "fail"],
    });
    expect(code).toBe(EXIT_TOOL);
  });

  it("prints help with exit 0", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runEngineCli({
      name: "test-engine",
      version: "1.0.0",
      help: "help text",
      commands,
      argv: ["node", "test-engine", "--help"],
    });
    expect(code).toBe(EXIT_SUCCESS);
    expect(log.mock.calls[0]?.[0]).toBe("help text");
    log.mockRestore();
  });

  it("prints usage with exit 2 for unknown command", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await runEngineCli({
      name: "test-engine",
      version: "1.0.0",
      help: "help text",
      commands,
      argv: ["node", "test-engine", "nope"],
    });
    expect(code).toBe(EXIT_USAGE);
    error.mockRestore();
  });
});