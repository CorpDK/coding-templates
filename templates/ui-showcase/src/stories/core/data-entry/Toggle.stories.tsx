import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toggle } from "@corpdk/ui-core";

const meta: Meta<typeof Toggle> = {
  title: "ui-core/Data Entry/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  args: {
    children: "Toggle",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const WithIcon: Story = {
  render: function Render() {
    return (
      <Toggle aria-label="Toggle bold">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
        </svg>
      </Toggle>
    );
  },
};
