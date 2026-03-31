import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
} from '@corpdk/ui-core';

const meta: Meta<typeof Card> = {
  title: 'ui-core/Data Display/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>A brief card description.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Card body content goes here.</p>
        </CardContent>
      </Card>
    );
  },
};

export const WithFooter: Story = {
  render: function Render() {
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>You have 3 unread messages.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Review your notifications below.</p>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline">Cancel</Button>
          <Button>Mark all read</Button>
        </CardFooter>
      </Card>
    );
  },
};
