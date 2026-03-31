import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from '@corpdk/ui-core';

const meta: Meta<typeof Badge> = {
  title: 'ui-core/Data Display/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    children: 'Badge',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
};

export const Outline: Story = {
  args: { variant: 'outline' },
};

export const AllVariants: Story = {
  render: function Render() {
    return (
      <div className="flex gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
    );
  },
};
