import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@corpdk/ui-core";

const meta: Meta<typeof InputGroup> = {
  title: "ui-core/Data Entry/InputGroup",
  component: InputGroup,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAddon: Story = {
  render: function Render() {
    return (
      <InputGroup>
        <InputGroupAddon align="inline-start">https://</InputGroupAddon>
        <InputGroupInput placeholder="example.com" />
      </InputGroup>
    );
  },
};

export const WithButton: Story = {
  render: function Render() {
    return (
      <InputGroup>
        <InputGroupInput placeholder="Search..." />
        <InputGroupButton>Go</InputGroupButton>
      </InputGroup>
    );
  },
};
