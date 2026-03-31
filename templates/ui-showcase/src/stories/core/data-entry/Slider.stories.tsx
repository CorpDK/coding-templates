import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Slider } from '@corpdk/ui-core';
import { useState } from 'react';

const meta: Meta<typeof Slider> = {
  title: 'ui-core/Data Entry/Slider',
  component: Slider,
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
  render: function Render() {
    const [value, setValue] = useState([50]);
    return <Slider value={value} onValueChange={setValue} max={100} step={1} />;
  },
};

export const Range: Story = {
  render: function Render() {
    const [value, setValue] = useState([25, 75]);
    return <Slider value={value} onValueChange={setValue} max={100} step={1} />;
  },
};
