import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useForm } from "react-hook-form";
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@corpdk/ui-core";

function FormDemo() {
  const form = useForm({ defaultValues: { username: "" } });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => undefined)}
        className="max-w-sm space-y-4"
      >
        <FormField
          control={form.control}
          name="username"
          rules={{ required: "Username is required." }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe" {...field} />
              </FormControl>
              <FormDescription>
                Your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}

const meta: Meta<typeof FormDemo> = {
  title: "ui-core/Data Entry/Form",
  component: FormDemo,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
