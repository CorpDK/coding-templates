/**
 * Placeholder WebSocket implementation. Runtime DS traffic uses SSE only; this
 * satisfies @graphql-tools/executor-graphql-ws imports during codegen.
 */
export class WebSocket {
  readyState = 0;
  /** @param {string} [url] Recorded for API parity; stub never opens a socket. */
  constructor(url) {
    this._url = url ?? undefined;
  }
}
export default WebSocket;
