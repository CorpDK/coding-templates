import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Calendar } from "@corpdk/ui-core";
import { useState } from "react";

const meta: Meta<typeof Calendar> = {
  title: "ui-core/Data Entry/Calendar",
  component: Calendar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>(new Date());
    return (
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        className="rounded-md border"
      />
    );
  },
};
