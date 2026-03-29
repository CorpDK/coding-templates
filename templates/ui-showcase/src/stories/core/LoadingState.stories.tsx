import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoadingState } from '@corpdk/ui-core';

const meta: Meta<typeof LoadingState> = {
  title: 'ui-core/LoadingState',
  component: LoadingState,
  tags: ['autodocs'],
  args: {
    message: 'Loading...',
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

export const CustomMessage: Story = {
  args: { message: 'Fetching data from server...' },
};
