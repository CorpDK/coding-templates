'use client';

import { useState } from "react";
import { SearchInput, FilterButton } from "@corpdk/ui-core";

const FILTERS = ["All", "Active", "Archived"] as const;
type Filter = (typeof FILTERS)[number];

export function PrimitivesInteractive() {
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
