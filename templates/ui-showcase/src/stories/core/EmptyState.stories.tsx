import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EmptyState } from '@corpdk/ui-core';

const meta: Meta<typeof EmptyState> = {
  title: 'ui-core/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: {
    message: 'No items found.',
  },
  decorators: [
    (Story) => (
      <div className="h-64">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoResults: Story = {
  args: { message: 'No results match your search criteria.' },
};
