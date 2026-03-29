import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ComponentShowcase } from '@corpdk/ui-core';

const meta: Meta<typeof ComponentShowcase> = {
  title: 'ui-core/ComponentShowcase',
  component: ComponentShowcase,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
