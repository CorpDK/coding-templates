/** Storybook docs URL for a story title such as `ui-core/Data Entry/Button`. */
export function storyDocsHref(storyTitle: string): string {
  const id = storyTitle.toLowerCase().replaceAll("/", "-").replaceAll(" ", "");
  return `/?path=/docs/${id}--docs`;
}

export const UI_CORE_CATEGORIES = [
  "Data Display",
  "Data Entry",
  "Feedback",
  "Layout",
  "Navigation",
] as const;

export type UiCoreCategory = (typeof UI_CORE_CATEGORIES)[number];
