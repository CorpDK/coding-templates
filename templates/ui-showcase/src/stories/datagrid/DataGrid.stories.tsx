import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataGrid, type DataGridColumn } from '@corpdk/ui-datagrid';
import { PEOPLE, type Person } from '../../lib/mock-data';

const columns: DataGridColumn<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'department', header: 'Department' },
  { accessorKey: 'startDate', header: 'Start Date' },
];

const meta: Meta<typeof DataGrid<Person>> = {
  title: 'ui-datagrid/DataGrid',
  component: DataGrid<Person>,
  tags: ['autodocs'],
  args: {
    data: PEOPLE,
    columns,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithClassName: Story = {
  args: { className: 'max-w-2xl' },
};
