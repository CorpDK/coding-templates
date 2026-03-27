'use client';

import { useMemo } from "react";
import { DataGrid, VirtualGrid, type DataGridColumn } from "@corpdk/ui-datagrid";
import { PEOPLE, type Person } from "@/lib/mock-data";

export default function DataGridPage() {
  const columns = useMemo<DataGridColumn<Person>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "role", header: "Role" },
      { accessorKey: "department", header: "Department" },
      { accessorKey: "startDate", header: "Start Date" },
    ],
    []
  );

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <h1 className="text-2xl font-bold">DataGrid</h1>

      <section className="space-y-2">
        <h2 className="font-semibold text-lg">DataGrid — sortable + filterable</h2>
        <DataGrid data={PEOPLE} columns={columns} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-lg">VirtualGrid — virtualized rows</h2>
        <VirtualGrid data={PEOPLE} columns={columns} rowHeight={48} />
      </section>
    </main>
  );
}
