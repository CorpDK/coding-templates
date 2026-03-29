import { type ColumnDef } from '@tanstack/react-table';

export type DataGridColumn<TData> = ColumnDef<TData>;

export interface DataGridProps<TData> {
  /** Array of row objects to render. */
  data: TData[];
  /** Column definitions (TanStack Table `ColumnDef`). */
  columns: DataGridColumn<TData>[];
  /** CSS class applied to the outermost wrapper. */
  className?: string;
}

export interface VirtualGridProps<TData> extends DataGridProps<TData> {
  /** Pixel height of each virtualized row. @default 48 */
  rowHeight?: number;
  /** Number of rows rendered outside the visible viewport for smoother scrolling. @default 10 */
  overscan?: number;
}
