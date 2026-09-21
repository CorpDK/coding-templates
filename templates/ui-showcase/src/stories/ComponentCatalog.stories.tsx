import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertTitle,
  AlertDescription,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Slider,
  Spinner,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toggle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@corpdk/ui-core";

interface CatalogEntry {
  name: string;
  category: string;
  storyId: string;
  render: () => React.ReactNode;
}

const CATALOG: CatalogEntry[] = [
  // Data Entry
  {
    name: "Button",
    category: "Data Entry",
    storyId: "ui-core-data-entry-button",
    render: () => (
      <div className="flex gap-2">
        <Button size="sm">Primary</Button>
        <Button size="sm" variant="secondary">
          Secondary
        </Button>
        <Button size="sm" variant="outline">
          Outline
        </Button>
      </div>
    ),
  },
  {
    name: "Input",
    category: "Data Entry",
    storyId: "ui-core-data-entry-input",
    render: () => (
      <Input placeholder="Type something..." className="max-w-[200px]" />
    ),
  },
  {
    name: "Textarea",
    category: "Data Entry",
    storyId: "ui-core-data-entry-textarea",
    render: () => (
      <Textarea placeholder="Write here..." className="max-w-[200px] h-16" />
    ),
  },
  {
    name: "Checkbox",
    category: "Data Entry",
    storyId: "ui-core-data-entry-checkbox",
    render: () => (
      <div className="flex items-center gap-2">
        <Checkbox id="demo-cb" defaultChecked />
        <Label htmlFor="demo-cb">Accept terms</Label>
      </div>
    ),
  },
  {
    name: "Switch",
    category: "Data Entry",
    storyId: "ui-core-data-entry-switch",
    render: () => (
      <div className="flex items-center gap-2">
        <Switch id="demo-sw" defaultChecked />
        <Label htmlFor="demo-sw">Notifications</Label>
      </div>
    ),
  },
  {
    name: "Select",
    category: "Data Entry",
    storyId: "ui-core-data-entry-select",
    render: () => (
      <Select defaultValue="opt1">
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="opt1">Option One</SelectItem>
          <SelectItem value="opt2">Option Two</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
  {
    name: "Slider",
    category: "Data Entry",
    storyId: "ui-core-data-entry-slider",
    render: () => (
      <Slider defaultValue={[50]} max={100} className="w-[180px]" />
    ),
  },
  {
    name: "Toggle",
    category: "Data Entry",
    storyId: "ui-core-data-entry-toggle",
    render: () => <Toggle aria-label="Toggle bold">B</Toggle>,
  },
  {
    name: "Label",
    category: "Data Entry",
    storyId: "ui-core-data-entry-label",
    render: () => <Label>Form label</Label>,
  },

  // Data Display
  {
    name: "Card",
    category: "Data Display",
    storyId: "ui-core-data-display-card",
    render: () => (
      <Card className="w-[220px]">
        <CardHeader className="p-3">
          <CardTitle className="text-sm">Card Title</CardTitle>
          <CardDescription className="text-xs">Description</CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
          Card content goes here.
        </CardContent>
      </Card>
    ),
  },
  {
    name: "Badge",
    category: "Data Display",
    storyId: "ui-core-data-display-badge",
    render: () => (
      <div className="flex gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </div>
    ),
  },
  {
    name: "Alert",
    category: "Data Display",
    storyId: "ui-core-data-display-alert",
    render: () => (
      <Alert className="max-w-[260px]">
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription className="text-xs">
          This is an alert message.
        </AlertDescription>
      </Alert>
    ),
  },
  {
    name: "Avatar",
    category: "Data Display",
    storyId: "ui-core-data-display-avatar",
    render: () => (
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    ),
  },
  {
    name: "Accordion",
    category: "Data Display",
    storyId: "ui-core-data-display-accordion",
    render: () => (
      <Accordion type="single" collapsible className="w-[220px]">
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-sm py-2">
            Section One
          </AccordionTrigger>
          <AccordionContent className="text-xs">Content here.</AccordionContent>
        </AccordionItem>
      </Accordion>
    ),
  },
  {
    name: "Tooltip",
    category: "Data Display",
    storyId: "ui-core-data-display-tooltip",
    render: () => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">
              Hover me
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
  },
  {
    name: "Skeleton",
    category: "Data Display",
    storyId: "ui-core-data-display-skeleton",
    render: () => (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-[180px]" />
        <Skeleton className="h-3 w-[140px]" />
      </div>
    ),
  },
  {
    name: "Spinner",
    category: "Data Display",
    storyId: "ui-core-data-display-spinner",
    render: () => <Spinner />,
  },
  {
    name: "Table",
    category: "Data Display",
    storyId: "ui-core-data-display-table",
    render: () => (
      <span className="text-xs text-muted-foreground">Sortable data table</span>
    ),
  },
  {
    name: "Separator",
    category: "Data Display",
    storyId: "ui-core-layout-separator",
    render: () => <Separator className="w-[180px]" />,
  },

  // Feedback
  {
    name: "Progress",
    category: "Feedback",
    storyId: "ui-core-feedback-progress",
    render: () => <Progress value={65} className="w-[180px]" />,
  },
  {
    name: "AlertDialog",
    category: "Feedback",
    storyId: "ui-core-feedback-alertdialog",
    render: () => (
      <span className="text-xs text-muted-foreground">Confirmation dialog</span>
    ),
  },
  {
    name: "Toast",
    category: "Feedback",
    storyId: "ui-core-feedback-toast",
    render: () => (
      <span className="text-xs text-muted-foreground">Toast notifications</span>
    ),
  },

  // Layout
  {
    name: "Dialog",
    category: "Layout",
    storyId: "ui-core-layout-dialog",
    render: () => (
      <span className="text-xs text-muted-foreground">Modal dialog</span>
    ),
  },
  {
    name: "Sheet",
    category: "Layout",
    storyId: "ui-core-layout-sheet",
    render: () => (
      <span className="text-xs text-muted-foreground">Slide-over panel</span>
    ),
  },
  {
    name: "Drawer",
    category: "Layout",
    storyId: "ui-core-layout-drawer",
    render: () => (
      <span className="text-xs text-muted-foreground">Bottom drawer</span>
    ),
  },
  {
    name: "Popover",
    category: "Layout",
    storyId: "ui-core-layout-popover",
    render: () => (
      <span className="text-xs text-muted-foreground">Floating popover</span>
    ),
  },
  {
    name: "HoverCard",
    category: "Layout",
    storyId: "ui-core-layout-hovercard",
    render: () => (
      <span className="text-xs text-muted-foreground">
        Hover-triggered card
      </span>
    ),
  },
  {
    name: "Collapsible",
    category: "Layout",
    storyId: "ui-core-layout-collapsible",
    render: () => (
      <span className="text-xs text-muted-foreground">Expand/collapse</span>
    ),
  },
  {
    name: "Resizable",
    category: "Layout",
    storyId: "ui-core-layout-resizable",
    render: () => (
      <span className="text-xs text-muted-foreground">Resizable panels</span>
    ),
  },
  {
    name: "ScrollArea",
    category: "Layout",
    storyId: "ui-core-layout-scrollarea",
    render: () => (
      <span className="text-xs text-muted-foreground">Custom scrollbar</span>
    ),
  },
  {
    name: "Sidebar",
    category: "Layout",
    storyId: "ui-core-layout-sidebar",
    render: () => (
      <span className="text-xs text-muted-foreground">App sidebar shell</span>
    ),
  },

  // Navigation
  {
    name: "Tabs",
    category: "Navigation",
    storyId: "ui-core-navigation-tabs",
    render: () => (
      <Tabs defaultValue="tab1" className="w-[220px]">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="text-xs p-2">
          First tab
        </TabsContent>
        <TabsContent value="tab2" className="text-xs p-2">
          Second tab
        </TabsContent>
      </Tabs>
    ),
  },
  {
    name: "Breadcrumb",
    category: "Navigation",
    storyId: "ui-core-navigation-breadcrumb",
    render: () => (
      <span className="text-xs text-muted-foreground">Breadcrumb trail</span>
    ),
  },
  {
    name: "Pagination",
    category: "Navigation",
    storyId: "ui-core-navigation-pagination",
    render: () => (
      <span className="text-xs text-muted-foreground">Page navigation</span>
    ),
  },
  {
    name: "Command",
    category: "Navigation",
    storyId: "ui-core-navigation-command",
    render: () => (
      <span className="text-xs text-muted-foreground">Command palette</span>
    ),
  },
  {
    name: "DropdownMenu",
    category: "Navigation",
    storyId: "ui-core-navigation-dropdownmenu",
    render: () => (
      <span className="text-xs text-muted-foreground">Dropdown menu</span>
    ),
  },
  {
    name: "ContextMenu",
    category: "Navigation",
    storyId: "ui-core-navigation-contextmenu",
    render: () => (
      <span className="text-xs text-muted-foreground">Right-click menu</span>
    ),
  },
  {
    name: "Menubar",
    category: "Navigation",
    storyId: "ui-core-navigation-menubar",
    render: () => (
      <span className="text-xs text-muted-foreground">App menubar</span>
    ),
  },
  {
    name: "NavigationMenu",
    category: "Navigation",
    storyId: "ui-core-navigation-navigationmenu",
    render: () => (
      <span className="text-xs text-muted-foreground">Top navigation</span>
    ),
  },
];

const CATEGORIES = [
  "Data Entry",
  "Data Display",
  "Feedback",
  "Layout",
  "Navigation",
] as const;

function CatalogCard({ entry }: Readonly<{ entry: CatalogEntry }>) {
  const storyUrl = `/?path=/docs/${entry.storyId}--docs`;

  return (
    <a
      href={storyUrl}
      target="_self"
      className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-accent/50"
    >
      <div className="mb-3 flex min-h-[48px] items-center">
        {entry.render()}
      </div>
      <p className="text-sm font-medium text-foreground group-hover:text-primary">
        {entry.name}
      </p>
    </a>
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
          {CATALOG.length} components available in{" "}
          <code className="text-xs">@corpdk/ui-core</code>. Click any component
          to view its full documentation and stories.
        </p>
      </div>
      {CATEGORIES.map((category) => {
        const entries = CATALOG.filter((e) => e.category === category);
        return (
          <section key={category}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {category}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {entries.map((entry) => (
                <CatalogCard key={entry.name} entry={entry} />
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
