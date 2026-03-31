import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Spinner } from '@corpdk/ui-core';

const meta: Meta<typeof Spinner> = {
  title: 'ui-core/Data Display/Spinner',
  component: Spinner,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = {
  args: { className: 'h-8 w-8' },
};
