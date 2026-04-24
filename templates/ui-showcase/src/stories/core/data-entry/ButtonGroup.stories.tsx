import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ButtonGroup, ButtonGroupSeparator, Button } from "@corpdk/ui-core";

const meta: Meta<typeof ButtonGroup> = {
  title: "ui-core/Data Entry/ButtonGroup",
  component: ButtonGroup,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: function Render() {
    return (
      <ButtonGroup>
        <Button variant="outline">Left</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">Center</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">Right</Button>
      </ButtonGroup>
    );
  },
};

export const Vertical: Story = {
  render: function Render() {
    return (
      <ButtonGroup orientation="vertical">
        <Button variant="outline">Top</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">Middle</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">Bottom</Button>
      </ButtonGroup>
    );
  },
};
