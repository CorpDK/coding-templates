interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export default function FilterButton({
  active,
  onClick,
  children,
}: Readonly<FilterButtonProps>) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
        active
          ? "bg-blue-500 text-white"
          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}
