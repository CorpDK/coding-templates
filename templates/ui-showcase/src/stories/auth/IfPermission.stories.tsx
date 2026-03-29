import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { IfPermission } from '@corpdk/ui-auth';
import { withAdminRole, withViewerRole } from './decorators';

function AdminPanel() {
  return <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded text-sm">Admin panel content.</div>;
}

function AccessDenied() {
  return <div className="p-4 bg-red-50 dark:bg-red-950 rounded text-sm">Access denied. Admin role required.</div>;
}

const meta: Meta<typeof IfPermission> = {
  title: 'ui-auth/IfPermission',
  component: IfPermission,
  tags: ['autodocs'],
  args: {
    role: 'admin',
    children: <AdminPanel />,
    fallback: <AccessDenied />,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const HasPermission: Story = {
  decorators: [withAdminRole],
};

export const NoPermission: Story = {
  decorators: [withViewerRole],
};
