import Link from "next/link";

const SECTIONS = [
  { href: "/primitives", label: "Primitives", desc: "LoadingState, ErrorState, EmptyState, SearchInput, FilterButton" },
  { href: "/datagrid", label: "DataGrid", desc: "Sortable, filterable table + virtualized variant" },
  { href: "/charts", label: "Charts", desc: "LineChart and BarChart with D3.js" },
  { href: "/forms", label: "Forms", desc: "React Hook Form + Zod validation patterns" },
  { href: "/feedback", label: "Feedback", desc: "Toaster notifications and ErrorBoundary" },
  { href: "/auth", label: "Auth", desc: "SignIn/SignOut, IfAuthenticated, IfPermission" },
];

export default function ShowcaseIndex() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">UI Showcase</h1>
      <p className="text-muted-foreground mb-8">
        Living reference for <code className="font-mono text-sm">@corpdk/ui-*</code> shared packages.
      </p>
      <div className="grid gap-4">
        {SECTIONS.map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="block p-4 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <div className="font-semibold mb-1">{label}</div>
            <div className="text-sm text-muted-foreground">{desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
