export interface StopHandle {
  /** Aborts on SIGINT, SIGTERM or when the optional deadline elapses. */
  signal: AbortSignal;
  /** Removes the process listeners and the deadline timer. */
  dispose(): void;
}

/**
 * Cooperative stop signal for long-running commands (subscriptions and
 * `--all` walks). All stop reasons end the command with exit 0 (doc 14 §4.5).
 */
export function createStopSignal(deadlineMs?: number): StopHandle {
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const timer =
    deadlineMs === undefined ? undefined : setTimeout(stop, deadlineMs);

  return {
    signal: controller.signal,
    dispose() {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}
