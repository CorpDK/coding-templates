export interface DataPoint {
  /** Horizontal axis value (numeric or Date). */
  x: number | Date;
  /** Vertical axis value. */
  y: number;
  /** Human-readable label used for axis ticks and tooltips. */
  label?: string;
}

export interface LineChartProps {
  /** Array of data points to plot. */
  data: DataPoint[];
  /** SVG width in pixels. @default 600 */
  width?: number;
  /** SVG height in pixels. @default 300 */
  height?: number;
  /** Stroke color for the line (CSS color string). @default TOKENS.primary */
  color?: string;
  /** CSS class applied to the SVG element. */
  className?: string;
}

export interface BarChartProps {
  /** Array of data points to plot. */
  data: DataPoint[];
  /** SVG width in pixels. @default 600 */
  width?: number;
  /** SVG height in pixels. @default 300 */
  height?: number;
  /** Fill color for the bars (CSS color string). @default TOKENS.primary */
  color?: string;
  /** Bar orientation. @default "vertical" */
  direction?: "vertical" | "horizontal";
  /** CSS class applied to the SVG element. */
  className?: string;
}
