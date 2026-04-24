import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@corpdk/ui-core";

const meta: Meta<typeof ResizablePanelGroup> = {
  title: "ui-core/Layout/Resizable",
  component: ResizablePanelGroup,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: function Render() {
    return (
      <ResizablePanelGroup
        direction="horizontal"
        className="max-w-md rounded-lg border h-[200px]"
      >
        <ResizablePanel defaultSize={50}>
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold">One</span>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50}>
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold">Two</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  },
};

export const Vertical: Story = {
  render: function Render() {
    return (
      <ResizablePanelGroup
        direction="vertical"
        className="max-w-md rounded-lg border h-[300px]"
      >
        <ResizablePanel defaultSize={25}>
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold">Header</span>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75}>
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold">Content</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  },
};
