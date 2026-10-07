import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { pingDatabase } from "./db/index.js";

function readPackageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const rel of ["../package.json", "../../package.json"]) {
    try {
      const path = join(here, rel);
      return (JSON.parse(readFileSync(path, "utf-8")) as { version: string }).version;
    } catch {
      continue;
    }
  }
  return "unknown";
}

const packageVersion = readPackageVersion();

export interface HealthPayload {
  status: "ok" | "degraded";
  uptime: number;
  version: string;
  db: {
    connected: boolean;
    latencyMs: number | null;
  };
}

export async function collectHealth(uptimeSeconds: number): Promise<HealthPayload> {
  const tracer = trace.getTracer("@corpdk/ds/health");
  const db = await tracer.startActiveSpan("db.health_ping", async (span) => {
    try {
      const result = await pingDatabase();
      span.setAttribute("db.connected", result.connected);
      if (result.latencyMs != null) {
        span.setAttribute("db.latency_ms", result.latencyMs);
      }
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      return { connected: false, latencyMs: null };
    } finally {
      span.end();
    }
  });

  const connected = db.connected;
  return {
    status: connected ? "ok" : "degraded",
    uptime: uptimeSeconds,
    version: packageVersion,
    db,
  };
}

export async function handleHealthRequest(
  req: IncomingMessage,
  res: ServerResponse,
  serverStartedAt: number,
): Promise<void> {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  const uptimeSeconds = Math.floor((Date.now() - serverStartedAt) / 1000);
  const body = await collectHealth(uptimeSeconds);
  const statusCode = body.status === "ok" ? 200 : 503;
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
