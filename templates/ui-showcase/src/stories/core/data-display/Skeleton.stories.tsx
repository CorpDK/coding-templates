import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Skeleton } from '@corpdk/ui-core';

const meta: Meta<typeof Skeleton> = {
  title: 'ui-core/Data Display/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    return (
      <div className="space-y-3 w-64">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  },
};

export const CardSkeleton: Story = {
  render: function Render() {
    return (
      <div className="flex items-center space-x-4 w-64">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  },
};
