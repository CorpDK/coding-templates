import {
  buildASTSchema,
  findBreakingChanges,
  findDangerousChanges,
  parse,
} from "graphql";

export type SchemaChange =
  | { type: "breaking"; description: string }
  | { type: "dangerous"; description: string };

export function stripSnapshotHeader(sdl: string): string {
  return sdl.replace(/^#.*\n+/, "");
}

export function compareSnapshots(
  oldSdl: string,
  newSdl: string,
): SchemaChange[] {
  const oldSchema = buildASTSchema(parse(stripSnapshotHeader(oldSdl)));
  const newSchema = buildASTSchema(parse(stripSnapshotHeader(newSdl)));

  const breaking = findBreakingChanges(oldSchema, newSchema).map((c) => ({
    type: "breaking" as const,
    description: c.description,
  }));
  const dangerous = findDangerousChanges(oldSchema, newSchema).map((c) => ({
    type: "dangerous" as const,
    description: c.description,
  }));
  return [...breaking, ...dangerous];
}
