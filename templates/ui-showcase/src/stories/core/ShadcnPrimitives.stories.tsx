import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Separator,
  Skeleton,
} from '@corpdk/ui-core';

const meta: Meta<typeof Button> = {
  title: 'ui-core/shadcn',
  tags: ['autodocs'],
  component: Button,
};

export default meta;

export const Buttons: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button size="sm">Small</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const InputWithLabel: StoryObj = {
  render: () => (
    <div className="w-64 flex flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
};

export const Badges: StoryObj = {
  render: () => (
    <div className="flex gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

export const CardExample: StoryObj = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>A brief card description.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Card body content goes here.</p>
      </CardContent>
    </Card>
  ),
};

export const SeparatorExample: StoryObj = {
  render: () => (
    <div className="w-64 space-y-2">
      <p className="text-sm">Above</p>
      <Separator />
      <p className="text-sm">Below</p>
    </div>
  ),
};

export const SkeletonExample: StoryObj = {
  render: () => (
    <div className="space-y-3 w-64">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  ),
};
