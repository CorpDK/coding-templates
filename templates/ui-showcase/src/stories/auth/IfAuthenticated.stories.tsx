import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { IfAuthenticated } from '@corpdk/ui-auth';
import { withAuthenticated, withUnauthenticated } from './decorators';

function AuthContent() {
  return <div className="p-4 bg-green-50 dark:bg-green-950 rounded text-sm">You are authenticated.</div>;
}

function AuthFallback() {
  return <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded text-sm">Please sign in to continue.</div>;
}

const meta: Meta<typeof IfAuthenticated> = {
  title: 'ui-auth/IfAuthenticated',
  component: IfAuthenticated,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Authenticated: Story = {
  decorators: [withAuthenticated],
  args: {
    children: <AuthContent />,
    fallback: <AuthFallback />,
  },
};

export const Unauthenticated: Story = {
  decorators: [withUnauthenticated],
  args: {
    children: <AuthContent />,
    fallback: <AuthFallback />,
  },
};
