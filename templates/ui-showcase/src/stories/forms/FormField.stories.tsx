import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormField, useZodForm, z } from "@corpdk/ui-forms";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

function FormFieldDemo({
  label,
  placeholder,
  type,
}: {
  label: string;
  placeholder: string;
  type: "text" | "email" | "password" | "number" | "tel" | "url";
}) {
  const form = useZodForm(schema);
  const fieldName = type === "email" ? "email" : "name";
  return (
    <form className="w-72">
      <FormField
        form={form}
        name={fieldName}
        label={label}
        placeholder={placeholder}
        type={type}
      />
    </form>
  );
}

const meta: Meta<typeof FormFieldDemo> = {
  title: "ui-forms/FormField",
  component: FormFieldDemo,
  tags: ["autodocs"],
  args: {
    label: "Email",
    placeholder: "you@example.com",
    type: "email" as const,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TextInput: Story = {
  args: { label: "Full Name", placeholder: "Jane Doe", type: "text" },
};

export const PasswordInput: Story = {
  args: { label: "Password", placeholder: "••••••••", type: "password" },
};
