/** True when OTLP export or explicit DS flag enables tracing. */
export function isOtelEnabled(): boolean {
  const flag = process.env.DS_OTEL_ENABLED;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim());
}

export function otelServiceName(): string {
  return process.env.OTEL_SERVICE_NAME?.trim() || "@corpdk/ds";
}
