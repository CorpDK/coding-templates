import type { Decorator } from "@storybook/nextjs-vite";

/** Default padded canvas for component stories. */
export const paddedCanvas: Decorator = (Story) => (
  <div className="p-4">
    <Story />
  </div>
);

/** Full-height canvas for layout shells such as Sidebar. */
export const fullHeightCanvas: Decorator = (Story) => (
  <div className="h-[500px] w-full">
    <Story />
  </div>
);

/** Width-constrained canvas for form controls and inputs. */
export const narrowCanvas =
  (width = "20rem"): Decorator =>
  (Story) => (
    <div className="w-80 max-w-full p-4">
      <Story />
    </div>
  );
