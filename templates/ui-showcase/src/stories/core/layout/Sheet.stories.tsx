import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Button,
} from '@corpdk/ui-core';

const meta: Meta<typeof Sheet> = {
  title: 'ui-core/Layout/Sheet',
  component: Sheet,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {
  render: function Render() {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Open Right</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetDescription>Sheet description goes here.</SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">Sheet content.</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  },
};

export const Left: Story = {
  render: function Render() {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Open Left</Button>
        </SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Left Sheet</SheetTitle>
            <SheetDescription>Opens from the left side.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  },
};
