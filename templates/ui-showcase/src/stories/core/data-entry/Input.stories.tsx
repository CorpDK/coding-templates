import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from '@corpdk/ui-core';

const meta: Meta<typeof Input> = {
  title: 'ui-core/Data Entry/Input',
  component: Input,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { type: 'text' },
};

export const WithPlaceholder: Story = {
  args: { placeholder: 'Enter your email...' },
};

export const Disabled: Story = {
  args: { placeholder: 'Disabled', disabled: true },
};
