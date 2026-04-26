import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormProps } from "react-hook-form";
import { type z } from "zod";

/**
 * Creates a React Hook Form instance pre-wired with a Zod schema resolver.
 *
 * @param schema - Zod schema used for validation.
 * @param options - Additional `useForm` options (resolver is provided automatically).
 * @returns A `UseFormReturn` instance typed to the schema's inferred type.
 */
export function useZodForm<TSchema extends z.ZodType<object>>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.infer<TSchema>>, "resolver">,
) {
  return useForm<z.infer<TSchema>>({
    ...options,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
  });
}
