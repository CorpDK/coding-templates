import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Progress } from '@corpdk/ui-core';
import { useEffect, useState } from 'react';

const meta: Meta<typeof Progress> = {
  title: 'ui-core/Feedback/Progress',
  component: Progress,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 60 },
};

export const Animated: Story = {
  render: function Render() {
    const [progress, setProgress] = useState(13);
    useEffect(() => {
      const timer = setTimeout(() => setProgress(66), 500);
      return () => clearTimeout(timer);
    }, []);
    return <Progress value={progress} />;
  },
};
