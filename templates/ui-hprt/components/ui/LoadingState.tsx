interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({
  message = "Loading...",
}: Readonly<LoadingStateProps>) {
  return (
    <div className="h-full w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="text-center text-lg text-zinc-600 dark:text-zinc-400">
        <div className="border-4 border-zinc-300 dark:border-zinc-700 border-t-zinc-800 dark:border-t-zinc-300 rounded-full w-10 h-10 animate-spin mx-auto mb-4"></div>
        <div>{message}</div>
      </div>
    </div>
  );
}
