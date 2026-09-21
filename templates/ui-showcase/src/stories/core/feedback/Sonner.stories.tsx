import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@corpdk/ui-core";
import { toast } from "sonner";

const meta: Meta = {
  title: "ui-core/Feedback/Sonner",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Sonner toast notifications via the global `SonnerToaster` mounted in the Storybook preview decorator.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    return (
      <Button variant="outline" onClick={() => toast("Event has been created")}>
        Show Sonner toast
      </Button>
    );
  },
};

export const Success: Story = {
  render: function Render() {
    return (
      <Button
        variant="outline"
        onClick={() => toast.success("Profile updated successfully")}
      >
        Show success toast
      </Button>
    );
  },
};

export const ErrorToast: Story = {
  render: function Render() {
    return (
      <Button
        variant="destructive"
        onClick={() => toast.error("Something went wrong")}
      >
        Show error toast
      </Button>
    );
  },
};
