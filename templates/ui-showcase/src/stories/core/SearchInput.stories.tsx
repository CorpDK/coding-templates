import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SearchInput } from '@corpdk/ui-core';
import { useState } from 'react';

const meta: Meta<typeof SearchInput> = {
  title: 'ui-core/SearchInput',
  component: SearchInput,
  tags: ['autodocs'],
  args: {
    placeholder: 'Search...',
    value: '',
    ringColor: 'ring-blue-500',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <SearchInput {...args} value={value} onChange={setValue} />;
  },
};

export const WithValue: Story = {
  args: { value: 'hello world' },
};

export const CustomRingColor: Story = {
  args: { ringColor: 'ring-emerald-500', placeholder: 'Search with green ring...' },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <SearchInput {...args} value={value} onChange={setValue} />;
  },
};
