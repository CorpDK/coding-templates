import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@corpdk/ui-core";

const meta: Meta<typeof ContextMenu> = {
  title: "ui-core/Navigation/ContextMenu",
  component: ContextMenu,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    return (
      <ContextMenu>
        <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
          Right click here
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem>
            Back <ContextMenuShortcut>Alt+Left</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            Forward <ContextMenuShortcut>Alt+Right</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            Reload <ContextMenuShortcut>Ctrl+R</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>Save As...</ContextMenuItem>
          <ContextMenuItem>Print</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
};
