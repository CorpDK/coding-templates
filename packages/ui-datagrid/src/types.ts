import { type ColumnDef } from '@tanstack/react-table';

export type DataGridColumn<TData> = ColumnDef<TData>;

export interface DataGridProps<TData> {
  data: TData[];
  columns: DataGridColumn<TData>[];
  className?: string;
}

export interface VirtualGridProps<TData> extends DataGridProps<TData> {
  rowHeight?: number;
  overscan?: number;
}
