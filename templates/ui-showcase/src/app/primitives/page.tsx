import {
  LoadingState,
  ErrorState,
  EmptyState,
  SearchInput,
  FilterButton,
} from "@corpdk/ui-core";
import { PrimitivesInteractive } from "./PrimitivesInteractive";

export default function PrimitivesPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
      <h1 className="text-2xl font-bold">Primitives</h1>

      <section className="space-y-2">
        <h2 className="font-semibold text-lg">LoadingState</h2>
        <div className="h-32 rounded border border-border overflow-hidden">
          <LoadingState />
        </div>
        <div className="h-32 rounded border border-border overflow-hidden">
          <LoadingState message="Fetching data..." />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-lg">ErrorState</h2>
        <div className="h-32 rounded border border-border overflow-hidden">
          <ErrorState error="Network request failed" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-lg">EmptyState</h2>
        <div className="h-32 rounded border border-border overflow-hidden">
          <EmptyState message="No items found" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-lg">SearchInput + FilterButton</h2>
        <PrimitivesInteractive />
      </section>
    </main>
  );
}
