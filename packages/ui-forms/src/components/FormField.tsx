"use client";

import {
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
  Controller,
} from "react-hook-form";

export interface FormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> {
  /** React Hook Form instance returned by `useForm` or `useZodForm`. */
  form: UseFormReturn<TFieldValues>;
  /** Field path within the form schema (dot-notation for nested fields). */
  name: TName;
  /** Label text rendered above the input. */
  label: string;
  /** Placeholder text shown when the input is empty. */
  placeholder?: string;
  /** HTML input type. @default "text" */
  type?: "text" | "email" | "password" | "number" | "tel" | "url";
}

export function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  form,
  name,
  label,
  placeholder,
  type = "text",
}: FormFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={String(name)}
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {label}
          </label>
          <input
            {...field}
            id={String(name)}
            type={type}
            placeholder={placeholder}
            value={field.value ?? ""}
            className="px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {fieldState.error && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}
