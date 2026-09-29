export type LintSeverity = "error" | "warn";

export interface LintViolation {
  severity: LintSeverity;
  code: string;
  message: string;
  entity?: string;
  column?: string;
}
