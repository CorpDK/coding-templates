import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@corpdk/ui-core";

const items = [
  { title: "Home", url: "#" },
  { title: "Inbox", url: "#" },
  { title: "Calendar", url: "#" },
  { title: "Search", url: "#" },
  { title: "Settings", url: "#" },
];

const meta: Meta<typeof Sidebar> = {
  title: "ui-core/Layout/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-[500px] w-full">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    return (
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <span className="px-2 text-lg font-semibold">App</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Application</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <a href={item.url}>{item.title}</a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <span className="px-2 text-xs text-muted-foreground">v1.0.0</span>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <span className="text-sm font-medium">Page Content</span>
          </header>
          <main className="p-4">
            <p className="text-sm text-muted-foreground">Main content area.</p>
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  },
};
