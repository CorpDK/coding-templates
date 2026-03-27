export interface DataPoint {
  x: number | Date;
  y: number;
  label?: string;
}

export interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export interface BarChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  direction?: 'vertical' | 'horizontal';
  className?: string;
}
