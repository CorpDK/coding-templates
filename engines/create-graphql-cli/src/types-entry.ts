export type EngineResult = {
  exitCode: 0 | 1 | 2 | 3;
  nextSteps?: string[];
  changedFiles: string[];
};
