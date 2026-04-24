import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Kbd, KbdGroup } from "@corpdk/ui-core";

const meta: Meta<typeof Kbd> = {
  title: "ui-core/Data Display/Kbd",
  component: Kbd,
  tags: ["autodocs"],
  args: {
    children: "K",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Group: Story = {
  render: function Render() {
    return (
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>Shift</Kbd>
        <Kbd>P</Kbd>
      </KbdGroup>
    );
  },
};
