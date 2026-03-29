interface SearchInputProps {
  /** Placeholder text shown when the input is empty. */
  placeholder: string;
  /** Current search string (controlled). */
  value: string;
  /** Called with the new value on every keystroke. */
  onChange: (value: string) => void;
  /** Tailwind ring-color class applied on focus. @default "ring-blue-500" */
  ringColor?: string;
}

export default function SearchInput({
  placeholder,
  value,
  onChange,
  ringColor = "ring-blue-500",
}: Readonly<SearchInputProps>) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
      className={`w-full px-3 py-2 mb-3 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 ${ringColor} focus:border-transparent`}
    />
  );
}
