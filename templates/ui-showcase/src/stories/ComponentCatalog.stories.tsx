import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { storyDocsHref, UI_CORE_CATEGORIES } from "../lib/storybook";
import { UI_CORE_CATALOG, type CatalogEntry } from "./core/catalog-entries";

function CatalogCard({ entry }: Readonly<{ entry: CatalogEntry }>) {
  const href = storyDocsHref(entry.storyTitle);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => {
        window.location.assign(href);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.location.assign(href);
        }
      }}
      className="group block cursor-pointer rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-accent/50"
    >
      <div
        className="pointer-events-none mb-3 flex min-h-[48px] items-center overflow-hidden"
        aria-hidden
      >
        {entry.render()}
      </div>
      <p className="text-sm font-medium text-foreground group-hover:text-primary">
        {entry.name}
      </p>
    </div>
  );
}

function ComponentCatalog() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Component Catalog
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {UI_CORE_CATALOG.length} components from{" "}
          <code className="text-xs">@corpdk/ui-core</code>. Click any card to
          open its documentation and stories.
        </p>
      </div>
      {UI_CORE_CATEGORIES.map((category) => {
        const entries = UI_CORE_CATALOG.filter((e) => e.category === category);
        return (
          <section key={category}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {category}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({entries.length})
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {entries.map((entry) => (
                <CatalogCard key={entry.storyTitle} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const meta: Meta = {
  title: "ui-core/Component Catalog",
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
    actions: { disable: true },
  },
};

export default meta;
type Story = StoryObj;

export const Catalog: Story = {
  render: () => <ComponentCatalog />,
};
