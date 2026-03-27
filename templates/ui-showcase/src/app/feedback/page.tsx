'use client';

import { useState } from "react";
import { useToast, AppErrorBoundary } from "@corpdk/ui-feedback";

function BrokenComponent(): never {
  throw new Error("Simulated render error");
}

function ErrorBoundaryDemo() {
  const [mounted, setMounted] = useState(false);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setMounted(true)}
        className="px-3 py-2 rounded bg-red-600 text-white text-sm"
      >
        Trigger error
      </button>
      {mounted && (
        <AppErrorBoundary onReset={() => setMounted(false)}>
          <BrokenComponent />
        </AppErrorBoundary>
      )}
    </div>
  );
}

export default function FeedbackPage() {
  const toast = useToast();

  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      <h1 className="text-2xl font-bold">Feedback</h1>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Toaster — useToast</h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => toast.success("Saved!", "Your changes have been saved.")}
            className="px-3 py-2 rounded bg-green-600 text-white text-sm"
          >
            Success
          </button>
          <button
            onClick={() => toast.error("Failed", "Something went wrong.")}
            className="px-3 py-2 rounded bg-red-600 text-white text-sm"
          >
            Error
          </button>
          <button
            onClick={() => toast.info("Info", "Here is some information.")}
            className="px-3 py-2 rounded bg-blue-600 text-white text-sm"
          >
            Info
          </button>
          <button
            onClick={() => toast.warning("Warning", "Proceed with caution.")}
            className="px-3 py-2 rounded bg-yellow-600 text-white text-sm"
          >
            Warning
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">AppErrorBoundary</h2>
        <p className="text-sm text-muted-foreground">
          Click the button to mount a component that throws. The ErrorBoundary catches it gracefully.
        </p>
        <ErrorBoundaryDemo />
      </section>
    </main>
  );
}
