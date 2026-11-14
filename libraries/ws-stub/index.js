/**
 * Placeholder WebSocket implementation. Runtime DS traffic uses SSE only; this
 * satisfies @graphql-tools/executor-graphql-ws imports during codegen.
 */
export class WebSocket {
  readyState = 0;
  /** @param {string} [_url] Unused — stub never opens a socket. */
  constructor(_url) {
    // Intentional no-op: satisfies `new WebSocket(url)` in transitive imports.
  }
}
export default WebSocket;
