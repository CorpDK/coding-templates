import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AppErrorBoundary } from '@corpdk/ui-feedback';
import { Button } from '@corpdk/ui-core';
import { useState } from 'react';

function BuggyChild() {
  const [shouldThrow, setShouldThrow] = useState(false);
  if (shouldThrow) throw new Error('Intentional test error');
  return (
    <Button variant="destructive" onClick={() => setShouldThrow(true)}>
      Trigger Error
    </Button>
  );
}

function ErrorBoundaryDemo() {
  return (
    <div className="h-64">
      <AppErrorBoundary>
        <BuggyChild />
      </AppErrorBoundary>
    </div>
  );
}

const meta: Meta<typeof ErrorBoundaryDemo> = {
  title: 'ui-feedback/AppErrorBoundary',
  component: ErrorBoundaryDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
