/**
 * Shared TypeScript type definitions
 */

/**
 * Standard props for components that handle async data states
 */
export interface AsyncStateProps {
  /** Whether data is currently being fetched. */
  loading: boolean;
  /** Error message from the last failed request, or empty string if none. */
  error: string;
}

/**
 * Generic item with an id, useful as a base for list data
 */
export interface IdentifiableItem {
  /** Unique identifier for the item. */
  id: string;
  /** Human-readable display name. */
  label: string;
}

/**
 * Generic filter option for FilterButton usage
 */
export interface FilterOption<T extends string = string> {
  /** Machine-readable value used for filtering logic. */
  value: T;
  /** Human-readable label shown in the UI. */
  label: string;
}
