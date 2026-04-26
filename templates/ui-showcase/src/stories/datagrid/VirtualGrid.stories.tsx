import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VirtualGrid, type DataGridColumn } from "@corpdk/ui-datagrid";

interface Row {
  id: string;
  name: string;
  value: number;
}

const LARGE_DATASET: Row[] = Array.from({ length: 1000 }, (_, i) => ({
  id: String(i + 1),
  name: `Item ${i + 1}`,
  value: Math.round(Math.random() * 1000),
}));

const columns: DataGridColumn<Row>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "value", header: "Value" },
];

const meta: Meta<typeof VirtualGrid<Row>> = {
  title: "ui-datagrid/VirtualGrid",
  component: VirtualGrid<Row>,
  tags: ["autodocs"],
  args: {
    data: LARGE_DATASET,
    columns,
    rowHeight: 48,
    overscan: 10,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SmallRows: Story = {
  args: { rowHeight: 32, overscan: 20 },
};
