import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function execAsync(
  command: string,
  options: { cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync("sh", ["-c", command], {
    cwd: options.cwd,
    env: process.env,
  });
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
}