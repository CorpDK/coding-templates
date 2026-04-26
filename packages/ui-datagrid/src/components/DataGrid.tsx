"use client";

import { flexRender } from "@tanstack/react-table";
import { useDataGrid } from "../hooks/useDataGrid";
import { type DataGridProps } from "../types";

function sortIndicator(direction: false | "asc" | "desc"): string {
  if (direction === "asc") return " ↑";
  if (direction === "desc") return " ↓";
  return "";
}

export function DataGrid<TData>({
  data,
  columns,
  className,
}: Readonly<DataGridProps<TData>>) {
  const { table, globalFilter, setGlobalFilter } = useDataGrid(data, columns);

  return (
    <div className={className}>
      <div className="mb-3">
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search..."
          className="w-full px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    {sortIndicator(header.column.getIsSorted())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-3 text-zinc-900 dark:text-zinc-100"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && (
          <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}
