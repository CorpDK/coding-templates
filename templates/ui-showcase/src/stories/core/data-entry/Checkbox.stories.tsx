import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Checkbox, Label } from '@corpdk/ui-core';

const meta: Meta<typeof Checkbox> = {
  title: 'ui-core/Data Entry/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const WithLabel: Story = {
  render: function Render() {
    return (
      <div className="flex items-center space-x-2">
        <Checkbox id="terms" />
        <Label htmlFor="terms">Accept terms and conditions</Label>
      </div>
    );
  },
};
