'use client';

import * as d3 from 'd3';
import { useD3 } from '../hooks/useD3';
import { type LineChartProps } from '../types';

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };

export function LineChart({
  data,
  width = 600,
  height = 300,
  color = '#3b82f6',
  className,
}: LineChartProps) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const ref = useD3<SVGSVGElement>(
    (svg) => {
      const g = svg
        .append('g')
        .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

      const xScale = d3
        .scaleLinear()
        .domain(d3.extent(data, (d) => Number(d.x)) as [number, number])
        .range([0, innerWidth]);

      const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.y) ?? 0])
        .nice()
        .range([innerHeight, 0]);

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale));

      g.append('g').call(d3.axisLeft(yScale));

      const line = d3
        .line<(typeof data)[0]>()
        .x((d) => xScale(Number(d.x)))
        .y((d) => yScale(d.y))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('d', line);
    },
    [data, width, height, color]
  );

  return <svg ref={ref} width={width} height={height} className={className} />;
}
