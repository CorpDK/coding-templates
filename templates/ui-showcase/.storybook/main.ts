import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/nextjs-vite',
  features: {
    experimentalRSC: true,
  },
};

export default config;
