import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useToast } from "@corpdk/ui-feedback";
import { Button } from "@corpdk/ui-core";

function ToastDemo() {
  const toast = useToast();

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={() => toast.success("Saved", "Your changes have been saved.")}
      >
        Success
      </Button>
      <Button
        variant="destructive"
        onClick={() => toast.error("Error", "Something went wrong.")}
      >
        Error
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.info("Info", "New version available.")}
      >
        Info
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.warning("Warning", "Disk space is running low.")}
      >
        Warning
      </Button>
    </div>
  );
}

const meta: Meta<typeof ToastDemo> = {
  title: "ui-feedback/useToast",
  component: ToastDemo,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
