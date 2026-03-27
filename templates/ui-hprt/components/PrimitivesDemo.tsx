"use client";

import { useState } from "react";
import { FilterButton, SearchInput } from "@corpdk/ui-core";

type FilterValue = "all" | "active" | "archived";

const FILTERS: Readonly<{ value: FilterValue; label: string }>[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export default function PrimitivesDemo() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");

  return (
    <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
      <SearchInput placeholder="Search items..." value={search} onChange={setSearch} />
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <FilterButton key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </FilterButton>
        ))}
      </div>
    </div>
  );
}
