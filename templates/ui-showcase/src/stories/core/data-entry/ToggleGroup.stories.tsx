import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ToggleGroup, ToggleGroupItem } from '@corpdk/ui-core';

const meta: Meta<typeof ToggleGroup> = {
  title: 'ui-core/Data Entry/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  args: { type: 'single' },
  render: function Render(args) {
    return (
      <ToggleGroup {...args}>
        <ToggleGroupItem value="left" aria-label="Align left">Left</ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center">Center</ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right">Right</ToggleGroupItem>
      </ToggleGroup>
    );
  },
};

export const Multiple: Story = {
  args: { type: 'multiple' },
  render: function Render(args) {
    return (
      <ToggleGroup {...args}>
        <ToggleGroupItem value="bold" aria-label="Bold">B</ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic">I</ToggleGroupItem>
        <ToggleGroupItem value="underline" aria-label="Underline">U</ToggleGroupItem>
      </ToggleGroup>
    );
  },
};
