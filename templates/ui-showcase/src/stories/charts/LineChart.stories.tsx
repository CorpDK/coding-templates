import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LineChart } from "@corpdk/ui-charts";
import { LINE_CHART_DATA } from "../../lib/mock-data";

const meta: Meta<typeof LineChart> = {
  title: "ui-charts/LineChart",
  component: LineChart,
  tags: ["autodocs"],
  args: {
    data: LINE_CHART_DATA,
    width: 600,
    height: 300,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: { width: 400, height: 200 },
};

export const CustomColor: Story = {
  args: { color: "#10b981" },
};
