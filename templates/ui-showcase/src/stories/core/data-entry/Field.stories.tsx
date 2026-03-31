import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from '@corpdk/ui-core';

const meta: Meta<typeof Field> = {
  title: 'ui-core/Data Entry/Field',
  component: Field,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  render: function Render() {
    return (
      <Field orientation="vertical" className="max-w-sm">
        <FieldLabel>Email</FieldLabel>
        <FieldContent>
          <Input placeholder="you@example.com" />
        </FieldContent>
        <FieldDescription>We&apos;ll never share your email.</FieldDescription>
      </Field>
    );
  },
};

export const Horizontal: Story = {
  render: function Render() {
    return (
      <Field orientation="horizontal" className="max-w-md">
        <FieldLabel>Username</FieldLabel>
        <FieldContent>
          <Input placeholder="johndoe" />
        </FieldContent>
      </Field>
    );
  },
};

export const WithError: Story = {
  render: function Render() {
    return (
      <Field orientation="vertical" className="max-w-sm">
        <FieldLabel>Password</FieldLabel>
        <FieldContent>
          <Input type="password" />
        </FieldContent>
        <FieldError>Password must be at least 8 characters.</FieldError>
      </Field>
    );
  },
};
