/**
 * Shared TypeScript type definitions
 */

/**
 * Standard props for components that handle async data states
 */
export interface AsyncStateProps {
  loading: boolean;
  error: string;
}

/**
 * Generic item with an id, useful as a base for list data
 */
export interface IdentifiableItem {
  id: string;
  label: string;
}

/**
 * Generic filter option for FilterButton usage
 */
export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
}
