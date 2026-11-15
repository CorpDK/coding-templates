export type EngineExitCode = 0 | 1 | 2 | 3;

export type EngineResult = {
  exitCode: EngineExitCode;
  nextSteps?: string[];
  changedFiles: string[];
  message?: string;
};

export interface Reporter {
  step(message: string): void;
  info(message: string): void;
  warn(message: string): void;
}

export const EXIT_SUCCESS = 0 as const;
export const EXIT_VALIDATION = 1 as const;
export const EXIT_USAGE = 2 as const;
export const EXIT_TOOL = 3 as const;
