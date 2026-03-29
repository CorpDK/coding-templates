import type { Preview } from '@storybook/nextjs-vite';
import { ThemeProvider, SonnerToaster } from '@corpdk/ui-core';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
    a11y: {
      test: 'todo',
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <Story />
        <SonnerToaster />
      </ThemeProvider>
    ),
  ],
};

export default preview;
