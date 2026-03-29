import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FilterButton } from '@corpdk/ui-core';
import { useState } from 'react';

const meta: Meta<typeof FilterButton> = {
  title: 'ui-core/FilterButton',
  component: FilterButton,
  tags: ['autodocs'],
  args: {
    active: false,
    children: 'All',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {};

export const Active: Story = {
  args: { active: true },
};

export const Toggle: Story = {
  render: function Render() {
    const [active, setActive] = useState(false);
    return (
      <FilterButton active={active} onClick={() => setActive(!active)}>
        {active ? 'Active' : 'Inactive'}
      </FilterButton>
    );
  },
};

export const Group: Story = {
  render: function Render() {
    const [selected, setSelected] = useState('all');
    const filters = ['All', 'Platform', 'Data', 'Security'];
    return (
      <div className="flex gap-2">
        {filters.map((f) => (
          <FilterButton
            key={f}
            active={selected === f.toLowerCase()}
            onClick={() => setSelected(f.toLowerCase())}
          >
            {f}
          </FilterButton>
        ))}
      </div>
    );
  },
};
