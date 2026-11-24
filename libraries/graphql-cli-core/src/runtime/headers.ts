import type { RuntimeConfig } from "../codegen/types.js";
import { UsageError } from "./errors.js";
import type { CliExtensions } from "./types.js";

export type HeaderMap = Record<string, string>;

const SENSITIVE_HEADER =
  /authorization|token|secret|api[-_]?key|cookie|password/i;
const AUTH_CREDENTIAL = /^(?:Bearer|Basic)\s+(\S.*)$/i;
const REDACTED = "<redacted>";

function isSensitiveHeaderName(name: string): boolean {
  return SENSITIVE_HEADER.exec(name) !== null;
}

function authorizationCredential(value: string): string | undefined {
  return AUTH_CREDENTIAL.exec(value)?.[1];
}

/** Sets a header, replacing any existing one that differs only by case. */
function setHeader(headers: HeaderMap, name: string, value: string): void {
  for (const existing of Object.keys(headers)) {
    if (existing.toLowerCase() === name.toLowerCase()) delete headers[existing];
  }
  headers[name] = value;
}

function parseExtraHeaders(
  json: string,
  envName: string,
): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new UsageError(`${envName} must contain a JSON object of headers`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new UsageError(`${envName} must contain a JSON object of headers`);
  }
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new UsageError(`${envName}: header "${name}" must be a string`);
    }
    out[name] = value;
  }
  return out;
}

/**
 * Builds the request headers: JSON defaults < bearer token from env <
 * `headersEnv` JSON < the extension header provider (called per request).
 * Secrets only ever come from the environment (doc 14 §4.7).
 */
export async function resolveHeaders(
  config: RuntimeConfig,
  env: NodeJS.ProcessEnv,
  endpoint: string,
  extensions?: CliExtensions,
): Promise<HeaderMap> {
  const headers: HeaderMap = {
    "Content-Type": "application/json",
    Accept: "application/graphql-response+json, application/json",
  };

  const token = config.transport.tokenEnv
    ? env[config.transport.tokenEnv]
    : undefined;
  if (token) setHeader(headers, "Authorization", `Bearer ${token}`);

  const headersEnv = config.transport.headersEnv;
  const extraJson = headersEnv ? env[headersEnv] : undefined;
  if (headersEnv && extraJson) {
    for (const [name, value] of Object.entries(
      parseExtraHeaders(extraJson, headersEnv),
    )) {
      setHeader(headers, name, value);
    }
  }

  const provided = await extensions?.headers?.({ endpoint });
  for (const [name, value] of Object.entries(provided ?? {})) {
    setHeader(headers, name, value);
  }
  return headers;
}

export function withHeader(
  headers: HeaderMap,
  name: string,
  value: string,
): HeaderMap {
  const copy = { ...headers };
  setHeader(copy, name, value);
  return copy;
}

/** Header copy that is safe to print: sensitive values are masked. */
export function redactHeaders(headers: HeaderMap): HeaderMap {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      isSensitiveHeaderName(name) ? REDACTED : value,
    ]),
  );
}

function urlCredentials(endpoint: string): string[] {
  try {
    const url = new URL(endpoint);
    return [
      url.username,
      url.password,
      decodeURIComponent(url.password),
    ].filter((part) => part.length > 0);
  } catch {
    return [];
  }
}

export interface Redactor {
  /** Registers the secrets carried by a freshly resolved header set. */
  learn(headers: HeaderMap): void;
  /** Scrubs every known secret from free text. */
  redact(text: string): string;
}

/**
 * Collects secrets (sensitive header values, the raw bearer token, URL
 * credentials) as headers are resolved and scrubs them from any text that
 * could reach stdout or stderr.
 */
export function createRedactor(endpoint: string): Redactor {
  const secrets = new Set<string>(urlCredentials(endpoint));
  return {
    learn(headers) {
      for (const [name, value] of Object.entries(headers)) {
        if (!isSensitiveHeaderName(name) || value.length === 0) continue;
        secrets.add(value);
        const credential = authorizationCredential(value);
        if (credential) secrets.add(credential);
      }
    },
    redact(text) {
      return [...secrets]
        .sort((a, b) => b.length - a.length)
        .reduce((out, secret) => out.split(secret).join(REDACTED), text);
    },
  };
}

/** `--endpoint` > the configured env variable > `defaultUrl`. */
export function resolveEndpoint(
  config: RuntimeConfig,
  env: NodeJS.ProcessEnv,
  override?: string,
): string | undefined {
  return (
    override ??
    (env[config.transport.httpUrlEnv] || config.transport.defaultUrl)
  );
}
