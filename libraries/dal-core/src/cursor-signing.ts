import { createHmac, timingSafeEqual } from "node:crypto";

let cachedSecret: string | null | undefined;

/** Resolved signing secret; empty env disables signing (local dev). */
export function resolveCursorSigningSecret(): string | null {
  if (cachedSecret === undefined) {
    const raw = process.env.DAL_CURSOR_SECRET?.trim();
    cachedSecret = raw && raw.length > 0 ? raw : null;
  }
  return cachedSecret;
}

/** Test hook — reset env cache between tests. */
export function resetCursorSigningSecretCache(): void {
  cachedSecret = undefined;
}

function signPayloadBase64(payloadBase64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadBase64, "utf8").digest("base64url");
}

export function encodeSignedCursorPayload(payloadBase64: string): string {
  const secret = resolveCursorSigningSecret();
  if (!secret) return payloadBase64;
  const signature = signPayloadBase64(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
}

export function decodeSignedCursorPayload(wire: string): string {
  const secret = resolveCursorSigningSecret();
  if (!secret) return wire;

  const dot = wire.indexOf(".");
  if (dot <= 0) {
    throw new Error("CURSOR_SIGNATURE_REQUIRED");
  }
  const payloadBase64 = wire.slice(0, dot);
  const signature = wire.slice(dot + 1);
  if (!payloadBase64 || !signature) {
    throw new Error("CURSOR_MALFORMED");
  }

  const expected = signPayloadBase64(payloadBase64, secret);
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("CURSOR_INVALID_SIGNATURE");
  }
  return payloadBase64;
}
