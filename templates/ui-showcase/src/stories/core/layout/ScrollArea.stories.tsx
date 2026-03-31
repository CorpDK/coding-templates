import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScrollArea, ScrollBar, Separator } from '@corpdk/ui-core';

const tags = Array.from({ length: 50 }).map((_, i) => `v1.2.0-beta.${i + 1}`);

const meta: Meta<typeof ScrollArea> = {
  title: 'ui-core/Layout/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  render: function Render() {
    return (
      <ScrollArea className="h-72 w-48 rounded-md border">
        <div className="p-4">
          <h4 className="mb-4 text-sm font-medium leading-none">Tags</h4>
          {tags.map((tag) => (
            <div key={tag}>
              <div className="text-sm">{tag}</div>
              <Separator className="my-2" />
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  },
};

export const Horizontal: Story = {
  render: function Render() {
    return (
      <ScrollArea className="w-96 whitespace-nowrap rounded-md border">
        <div className="flex w-max space-x-4 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="w-[150px] h-[200px] shrink-0 rounded-md bg-muted flex items-center justify-center"
            >
              <span className="text-sm text-muted-foreground">Item {i + 1}</span>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  },
};
