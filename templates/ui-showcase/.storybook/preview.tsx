import type { Preview } from '@storybook/nextjs-vite';
import {
  StyleProvider,
  SonnerToaster,
  type BrandConfig,
  defaultNeutralBrand,
  corporateBlueBrand,
  sharpEnterpriseBrand,
  vibrantStartupBrand,
} from '@corpdk/ui-core';
import '../src/styles/globals.scss';

const BRAND_MAP: Record<string, BrandConfig> = {
  'default-neutral': defaultNeutralBrand as BrandConfig,
  'corporate-blue': corporateBlueBrand as BrandConfig,
  'sharp-enterprise': sharpEnterpriseBrand as BrandConfig,
  'vibrant-startup': vibrantStartupBrand as BrandConfig,
};

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
  globalTypes: {
    brand: {
      description: 'Brand theme preset',
      toolbar: {
        title: 'Brand',
        icon: 'paintbrush',
        items: [
          { value: 'default-neutral', title: 'Default Neutral' },
          { value: 'corporate-blue', title: 'Corporate Blue' },
          { value: 'sharp-enterprise', title: 'Sharp Enterprise' },
          { value: 'vibrant-startup', title: 'Vibrant Startup' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    brand: 'default-neutral',
  },
  decorators: [
    (Story, context) => {
      const brandKey = (context.globals.brand as string) || 'default-neutral';
      const brandConfig = BRAND_MAP[brandKey] ?? BRAND_MAP['default-neutral'];

      return (
        <StyleProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          brand={brandConfig}
        >
          <Story />
          <SonnerToaster />
        </StyleProvider>
      );
    },
  ],
};

export default preview;
