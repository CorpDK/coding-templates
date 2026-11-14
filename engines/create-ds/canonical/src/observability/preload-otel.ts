import { isOtelEnabled, otelServiceName } from "./otel-config.js";

if (isOtelEnabled()) {
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { OTLPTraceExporter } = await import(
    "@opentelemetry/exporter-trace-otlp-http"
  );
  const { resourceFromAttributes } = await import("@opentelemetry/resources");
  const { ATTR_SERVICE_NAME } = await import(
    "@opentelemetry/semantic-conventions"
  );
  const { HttpInstrumentation } = await import(
    "@opentelemetry/instrumentation-http"
  );
  const { PgInstrumentation } = await import(
    "@opentelemetry/instrumentation-pg"
  );

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: otelServiceName(),
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: true }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    void sdk.shutdown();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
