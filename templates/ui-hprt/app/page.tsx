import { EmptyState, ErrorState, LoadingState } from "@corpdk/ui-core";
import PrimitivesDemo from "@/components/PrimitivesDemo";

const FEATURES = [
  {
    title: "App Router",
    description:
      "Next.js App Router with TypeScript, server components, layouts, and nested routing.",
    icon: "N",
  },
  {
    title: "Tailwind CSS v4",
    description:
      "Utility-first CSS with dark mode support and CSS variable theming.",
    icon: "T",
  },
  {
    title: "UI Primitives",
    description:
      "Ready-to-use LoadingState, ErrorState, EmptyState, SearchInput, and FilterButton components.",
    icon: "U",
  },
  {
    title: "Type Safety",
    description:
      "Centralized TypeScript interfaces in types/index.ts with strict mode enabled.",
    icon: "TS",
  },
  {
    title: "urql + Graphcache",
    description:
      "High-performance GraphQL client with normalized caching, subscriptions, and real-time updates.",
    icon: "G",
  },
  {
    title: "Clean Architecture",
    description:
      "Pure components, single responsibility, useMemo for expensive computations, consistent patterns.",
    icon: "A",
  },
];

function FeatureCard({
  title,
  description,
  icon,
}: Readonly<{
  title: string;
  description: string;
  icon: string;
}>) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <div className="w-10 h-10 rounded-md bg-blue-500 text-white flex items-center justify-center text-sm font-bold mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        {title}
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Next.js Template (HPRT)
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Next.js + React 19 + TypeScript 5 + Tailwind CSS v4 + urql + Graphcache
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
            What&apos;s included
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
            UI primitives
          </h2>
          <div className="space-y-6">
            <div>
              <p className="text-xs font-mono text-zinc-400 mb-2">
                LoadingState
              </p>
              <div className="h-24 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <LoadingState message="Loading data..." />
              </div>
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-400 mb-2">ErrorState</p>
              <div className="h-24 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <ErrorState
                  error="Something went wrong."
                  hint="This is a demo error state."
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-400 mb-2">EmptyState</p>
              <div className="h-24 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <EmptyState message="No items found." />
              </div>
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-400 mb-2">
                SearchInput + FilterButton
              </p>
              <PrimitivesDemo />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
