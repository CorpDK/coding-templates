import { createServer, type Server } from "node:http";
import { createYoga } from "graphql-yoga";

type SseYogaSchema = NonNullable<Parameters<typeof createYoga>[0]["schema"]>;

export function createSseYogaServer(schema: SseYogaSchema) {
  return createYoga({
    schema,
    graphiql: process.env.NODE_ENV !== "production",
    logging: true,
  });
}

export function createSseYogaHttpServer(schema: SseYogaSchema): Server {
  return createServer(createSseYogaServer(schema));
}

export function listenSseYogaHttpServer(
  server: Server,
  port: number,
  packageLabel: string,
  extraStartupLines: readonly string[] = [],
): void {
  server.listen(port, () => {
    const addr = server.address();
    const boundPort = addr && typeof addr === "object" ? addr.port : port;
    const base = `http://localhost:${boundPort}/graphql`;
    console.log(`${packageLabel}  HTTP  ${base}`);
    for (const line of extraStartupLines) {
      console.log(line);
    }
    console.log(
      `${packageLabel}  SSE   ${base}  (subscriptions: Accept: text/event-stream)`,
    );
  });
}
