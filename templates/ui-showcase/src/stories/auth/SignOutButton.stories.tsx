import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SignOutButton } from '@corpdk/ui-auth';
import { withAuthenticated } from './decorators';

const meta: Meta<typeof SignOutButton> = {
  title: 'ui-auth/SignOutButton',
  component: SignOutButton,
  tags: ['autodocs'],
  decorators: [withAuthenticated],
  args: {
    children: 'Sign out',
    callbackUrl: '/',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomLabel: Story = {
  args: { children: 'Log out' },
};
