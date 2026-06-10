import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button, useToast } from "@corpdk/ui-core";

const meta: Meta = {
  title: "ui-core/Feedback/Toast",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Radix-based toast notifications via the global `Toaster` in the Storybook preview and the `useToast` hook.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const { toast } = useToast();
    return (
      <Button
        variant="outline"
        onClick={() =>
          toast({
            title: "Scheduled: Catch up",
            description: "Friday, February 10, 2025 at 5:57 PM",
          })
        }
      >
        Show Toast
      </Button>
    );
  },
};

export const Destructive: Story = {
  render: function Render() {
    const { toast } = useToast();
    return (
      <Button
        variant="destructive"
        onClick={() =>
          toast({
            variant: "destructive",
            title: "Uh oh! Something went wrong.",
            description: "There was a problem with your request.",
          })
        }
      >
        Show Error Toast
      </Button>
    );
  },
};
