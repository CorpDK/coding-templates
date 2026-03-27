interface EmptyStateProps {
  message: string;
}

export default function EmptyState({ message }: Readonly<EmptyStateProps>) {
  return (
    <div className="h-full w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="text-center text-lg text-zinc-600 dark:text-zinc-400">
        {message}
      </div>
    </div>
  );
}
