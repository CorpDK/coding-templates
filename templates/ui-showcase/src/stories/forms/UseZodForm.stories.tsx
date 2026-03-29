import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FormField, useZodForm, z } from '@corpdk/ui-forms';
import { Button } from '@corpdk/ui-core';
import { useToast } from '@corpdk/ui-feedback';

const registrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

function ZodFormDemo() {
  const form = useZodForm(registrationSchema);
  const toast = useToast();

  const onSubmit = form.handleSubmit((data) => {
    toast.success('Form submitted', `Name: ${data.name}, Email: ${data.email}`);
  });

  return (
    <form onSubmit={onSubmit} className="w-80 space-y-4">
      <FormField form={form} name="name" label="Name" placeholder="Jane Doe" />
      <FormField form={form} name="email" label="Email" placeholder="jane@example.com" type="email" />
      <Button type="submit">Submit</Button>
    </form>
  );
}

const meta: Meta<typeof ZodFormDemo> = {
  title: 'ui-forms/useZodForm',
  component: ZodFormDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
