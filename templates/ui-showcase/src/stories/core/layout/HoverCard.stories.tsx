import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
} from '@corpdk/ui-core';

const meta: Meta<typeof HoverCard> = {
  title: 'ui-core/Layout/HoverCard',
  component: HoverCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant="link">@nextjs</Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="flex justify-between space-x-4">
            <Avatar>
              <AvatarImage src="https://github.com/vercel.png" />
              <AvatarFallback>VC</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">@nextjs</h4>
              <p className="text-sm">
                The React Framework &ndash; created and maintained by @vercel.
              </p>
              <p className="text-xs text-muted-foreground">Joined December 2021</p>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  },
};
