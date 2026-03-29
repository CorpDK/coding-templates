import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BarChart } from '@corpdk/ui-charts';
import { BAR_CHART_DATA } from '../../lib/mock-data';

const meta: Meta<typeof BarChart> = {
  title: 'ui-charts/BarChart',
  component: BarChart,
  tags: ['autodocs'],
  args: {
    data: BAR_CHART_DATA,
    width: 600,
    height: 300,
    direction: 'vertical',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {};

export const Horizontal: Story = {
  args: { direction: 'horizontal' },
};

export const CustomColor: Story = {
  args: { color: '#f59e0b' },
};
