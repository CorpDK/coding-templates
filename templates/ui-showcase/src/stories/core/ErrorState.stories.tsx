import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ErrorState } from '@corpdk/ui-core';

const meta: Meta<typeof ErrorState> = {
  title: 'ui-core/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  args: {
    error: 'Failed to fetch data',
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

export const WithCustomHint: Story = {
  args: {
    error: 'Network timeout',
    hint: 'Check your VPN connection and retry.',
  },
};
