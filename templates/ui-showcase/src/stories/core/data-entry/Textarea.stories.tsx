import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Textarea } from '@corpdk/ui-core';

const meta: Meta<typeof Textarea> = {
  title: 'ui-core/Data Entry/Textarea',
  component: Textarea,
  tags: ['autodocs'],
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

export const Default: Story = {
  args: { placeholder: 'Type your message here...' },
};

export const Disabled: Story = {
  args: { placeholder: 'Disabled', disabled: true },
};
