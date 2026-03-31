import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Button,
} from '@corpdk/ui-core';

const meta: Meta<typeof Empty> = {
  title: 'ui-core/Data Display/Empty',
  component: Empty,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </EmptyMedia>
          <EmptyTitle>No results found</EmptyTitle>
          <EmptyDescription>
            Try adjusting your search or filter to find what you&apos;re looking for.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  },
};

export const WithAction: Story = {
  render: function Render() {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No projects yet</EmptyTitle>
          <EmptyDescription>Get started by creating your first project.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button>Create project</Button>
        </EmptyContent>
      </Empty>
    );
  },
};
