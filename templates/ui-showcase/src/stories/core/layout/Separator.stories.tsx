import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Separator } from "@corpdk/ui-core";

const meta: Meta<typeof Separator> = {
  title: "ui-core/Layout/Separator",
  component: Separator,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: function Render() {
    return (
      <div className="w-64 space-y-2">
        <p className="text-sm">Above</p>
        <Separator />
        <p className="text-sm">Below</p>
      </div>
    );
  },
};

export const Vertical: Story = {
  render: function Render() {
    return (
      <div className="flex h-5 items-center gap-4 text-sm">
        <span>Left</span>
        <Separator orientation="vertical" />
        <span>Right</span>
      </div>
    );
  },
};
