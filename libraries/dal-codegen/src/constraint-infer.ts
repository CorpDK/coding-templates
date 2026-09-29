import type { Column } from "drizzle-orm";
import type { Check } from "drizzle-orm/pg-core";

export interface InferredColumnConstraints {
  maxLength?: number;
  minLength?: number;
  minExclusive?: number;
  minInclusive?: number;
}

function sqlCheckText(check: Check): string {
  const sqlValue = check.value as { queryChunks?: unknown[] };
  const chunks = sqlValue.queryChunks ?? [];
  let text = "";
  for (const chunk of chunks) {
    const rec = chunk as { constructor?: { name?: string }; value?: string[]; name?: string };
    if (rec.constructor?.name === "StringChunk" && Array.isArray(rec.value)) {
      text += rec.value.join("");
    } else if (typeof rec.name === "string") {
      text += `@${rec.name}@`;
    }
  }
  return text.trim();
}

function parseCheckForColumn(
  drizzleKey: string,
  text: string,
): Pick<InferredColumnConstraints, "minLength" | "minExclusive" | "minInclusive"> {
  const marker = `@${drizzleKey}@`;
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const charLenMin = text.match(
    new RegExp(`char_length\\(\\s*${escapedMarker}\\s*\\)\\s*>=\\s*(\\d+)`),
  );
  if (charLenMin) {
    return { minLength: Number(charLenMin[1]) };
  }
  const lengthMin = text.match(
    new RegExp(`length\\(\\s*${escapedMarker}\\s*\\)\\s*>=\\s*(\\d+)`),
  );
  if (lengthMin) {
    return { minLength: Number(lengthMin[1]) };
  }
  if (!text.includes(marker)) return {};
  const rest = text.split(marker)[1]?.trim() ?? "";
  if (/^>\s*0(?:\s|$)/.test(rest)) {
    return { minExclusive: 0 };
  }
  if (/^>=\s*0(?:\s|$)/.test(rest)) {
    return { minInclusive: 0 };
  }
  return {};
}

export function inferLengthConstraint(col: Column): number | undefined {
  const length = (col as Column & { length?: number }).length;
  return typeof length === "number" && length > 0 ? length : undefined;
}

export function inferCheckConstraintsForTable(
  checks: Check[] | undefined,
  drizzleKeys: string[],
): Map<string, InferredColumnConstraints> {
  const byKey = new Map<string, InferredColumnConstraints>();
  if (!checks?.length) return byKey;

  for (const check of checks) {
    const text = sqlCheckText(check);
    for (const key of drizzleKeys) {
      const parsed = parseCheckForColumn(key, text);
      if (
        parsed.minLength == null &&
        parsed.minExclusive == null &&
        parsed.minInclusive == null
      ) {
        continue;
      }
      const existing = byKey.get(key) ?? {};
      byKey.set(key, { ...existing, ...parsed });
    }
  }
  return byKey;
}

export function formatValidationHint(constraints: InferredColumnConstraints): string | undefined {
  const parts: string[] = [];
  if (constraints.maxLength != null) {
    parts.push(`max length ${constraints.maxLength}`);
  }
  if (constraints.minLength != null) {
    parts.push(`min length ${constraints.minLength}`);
  }
  if (constraints.minExclusive != null) {
    parts.push(`must be > ${constraints.minExclusive}`);
  }
  if (constraints.minInclusive != null) {
    parts.push(`must be >= ${constraints.minInclusive}`);
  }
  if (parts.length === 0) return undefined;
  return `Validation: ${parts.join("; ")}.`;
}
