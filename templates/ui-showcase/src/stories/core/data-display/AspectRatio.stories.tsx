import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AspectRatio } from '@corpdk/ui-core';

const meta: Meta<typeof AspectRatio> = {
  title: 'ui-core/Data Display/AspectRatio',
  component: AspectRatio,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[450px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { ratio: 16 / 9 },
  render: function Render(args) {
    return (
      <AspectRatio {...args} className="bg-muted rounded-md">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          16 : 9
        </div>
      </AspectRatio>
    );
  },
};

export const Square: Story = {
  args: { ratio: 1 },
  render: function Render(args) {
    return (
      <AspectRatio {...args} className="bg-muted rounded-md">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          1 : 1
        </div>
      </AspectRatio>
    );
  },
};
