interface ErrorStateProps {
  /** Error message to display prominently. */
  error: string;
  /** Supplementary hint text shown below the error. @default "Please try again or check the console for details." */
  hint?: string;
}

export default function ErrorState({
  error,
  hint = "Please try again or check the console for details.",
}: Readonly<ErrorStateProps>) {
  return (
    <div className="h-full w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-4 rounded max-w-md">
        <strong>Error loading data</strong>
        <br />
        {error}
        <br />
        <br />
        <small>{hint}</small>
      </div>
    </div>
  );
}
