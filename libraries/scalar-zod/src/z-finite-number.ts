import { z, type ZodNumber } from "zod";

/** Finite IEEE number (replaces deprecated `ZodNumber.finite()`). */
export function zFiniteNumber(): ZodNumber {
  return z.number().refine((n) => Number.isFinite(n), {
    message: "Expected a finite number",
  });
}
