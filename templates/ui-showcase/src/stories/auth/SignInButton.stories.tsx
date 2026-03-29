import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SignInButton } from '@corpdk/ui-auth';
import { withUnauthenticated } from './decorators';

const meta: Meta<typeof SignInButton> = {
  title: 'ui-auth/SignInButton',
  component: SignInButton,
  tags: ['autodocs'],
  decorators: [withUnauthenticated],
  args: {
    children: 'Sign in',
    callbackUrl: '/',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithProvider: Story = {
  args: { provider: 'github', children: 'Sign in with GitHub' },
};

export const CustomStyled: Story = {
  args: {
    children: 'Get Started',
    className: 'px-6 py-3 rounded-lg bg-emerald-600 text-white text-base font-semibold hover:bg-emerald-700',
  },
};
