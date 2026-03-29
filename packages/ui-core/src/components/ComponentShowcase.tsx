"use client";

import { useState } from "react";
import SearchInput from "./SearchInput";
import FilterButton from "./FilterButton";

const FILTERS = ["All", "Active", "Archived"] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Interactive demo of ui-core primitives: SearchInput and FilterButton.
 *
 * Exported from ui-core so that all consuming apps (ui, ui-showcase, etc.)
 * share a single implementation that stays in sync with the actual exported API.
 */
export default function ComponentShowcase() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  return (
    <div className="space-y-3 p-4 rounded border border-border">
      <SearchInput
        placeholder="Type to search..."
        value={search}
        onChange={setSearch}
      />
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <FilterButton key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f}
          </FilterButton>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Search: <strong>{search || "(empty)"}</strong> — Filter: <strong>{filter}</strong>
      </p>
    </div>
  );
}
