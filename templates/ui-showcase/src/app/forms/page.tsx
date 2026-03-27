'use client';

import { useZodForm, FormField, z } from "@corpdk/ui-forms";

const createSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Must be a valid email"),
  role: z.string().min(1, "Role is required"),
});

export default function FormsPage() {
  const form = useZodForm(createSchema, { defaultValues: { name: "", email: "", role: "" } });

  const onSubmit = form.handleSubmit((data) => {
    console.log("Form submitted:", data);
    form.reset();
  });

  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      <h1 className="text-2xl font-bold">Forms</h1>

      <section className="space-y-4">
        <h2 className="font-semibold text-lg">useZodForm + FormField</h2>
        <form onSubmit={onSubmit} className="space-y-4 p-4 rounded border border-border">
          <FormField form={form} name="name" label="Full Name" placeholder="Alice Chen" />
          <FormField form={form} name="email" label="Email" type="email" placeholder="alice@example.com" />
          <FormField form={form} name="role" label="Role" placeholder="Engineer" />
          <button
            type="submit"
            className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Submit
          </button>
          {form.formState.isSubmitSuccessful && (
            <p className="text-sm text-green-600">Form submitted successfully!</p>
          )}
        </form>
      </section>
    </main>
  );
}
