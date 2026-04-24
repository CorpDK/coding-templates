import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label, Input } from "@corpdk/ui-core";

const meta: Meta<typeof Label> = {
  title: "ui-core/Data Entry/Label",
  component: Label,
  tags: ["autodocs"],
  args: {
    children: "Email address",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithInput: Story = {
  render: function Render() {
    return (
      <div className="flex flex-col gap-2 w-64">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" />
      </div>
    );
  },
};
