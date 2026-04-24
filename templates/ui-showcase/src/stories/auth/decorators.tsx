import type { Decorator } from "@storybook/nextjs-vite";
import { SessionProvider } from "@corpdk/ui-auth";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockSession = {
  user: {
    name: "Test User",
    email: "test@example.com",
    role: "admin",
  },
  expires: "2099-01-01T00:00:00.000Z",
} as any;

const viewerSession = {
  user: {
    name: "Test User",
    email: "test@example.com",
    role: "viewer",
  },
  expires: "2099-01-01T00:00:00.000Z",
} as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export const withUnauthenticated: Decorator = (Story) => (
  <SessionProvider session={null}>
    <Story />
  </SessionProvider>
);

export const withAuthenticated: Decorator = (Story) => (
  <SessionProvider session={mockSession}>
    <Story />
  </SessionProvider>
);

export const withAdminRole: Decorator = (Story) => (
  <SessionProvider session={mockSession}>
    <Story />
  </SessionProvider>
);

export const withViewerRole: Decorator = (Story) => (
  <SessionProvider session={viewerSession}>
    <Story />
  </SessionProvider>
);
