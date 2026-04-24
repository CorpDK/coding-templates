import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Switch, Label } from "@corpdk/ui-core";
import { useState } from "react";

const meta: Meta<typeof Switch> = {
  title: "ui-core/Data Entry/Switch",
  component: Switch,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const [checked, setChecked] = useState(false);
    return <Switch checked={checked} onCheckedChange={setChecked} />;
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WithLabel: Story = {
  render: function Render() {
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex items-center gap-2">
        <Switch id="airplane" checked={checked} onCheckedChange={setChecked} />
        <Label htmlFor="airplane">Airplane Mode</Label>
      </div>
    );
  },
};
