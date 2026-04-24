"use client";

import * as d3 from "d3";
import { useD3 } from "../hooks/useD3";
import { type BarChartProps } from "../types";

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };

export function BarChart({
  data,
  width = 600,
  height = 300,
  color = "#3b82f6",
  direction = "vertical",
  className,
}: BarChartProps) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const ref = useD3<SVGSVGElement>(
    (svg) => {
      const g = svg
        .append("g")
        .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

      const labels = data.map((d) => d.label ?? String(d.x));

      if (direction === "vertical") {
        const xScale = d3
          .scaleBand()
          .domain(labels)
          .range([0, innerWidth])
          .padding(0.2);

        const yScale = d3
          .scaleLinear()
          .domain([0, d3.max(data, (d) => d.y) ?? 0])
          .nice()
          .range([innerHeight, 0]);

        g.append("g")
          .attr("transform", `translate(0,${innerHeight})`)
          .call(d3.axisBottom(xScale));

        g.append("g").call(d3.axisLeft(yScale));

        g.selectAll("rect")
          .data(data)
          .join("rect")
          .attr("x", (d) => xScale(d.label ?? String(d.x)) ?? 0)
          .attr("y", (d) => yScale(d.y))
          .attr("width", xScale.bandwidth())
          .attr("height", (d) => innerHeight - yScale(d.y))
          .attr("fill", color);
      } else {
        const yScale = d3
          .scaleBand()
          .domain(labels)
          .range([0, innerHeight])
          .padding(0.2);

        const xScale = d3
          .scaleLinear()
          .domain([0, d3.max(data, (d) => d.y) ?? 0])
          .nice()
          .range([0, innerWidth]);

        g.append("g")
          .attr("transform", `translate(0,${innerHeight})`)
          .call(d3.axisBottom(xScale));

        g.append("g").call(d3.axisLeft(yScale));

        g.selectAll("rect")
          .data(data)
          .join("rect")
          .attr("x", 0)
          .attr("y", (d) => yScale(d.label ?? String(d.x)) ?? 0)
          .attr("width", (d) => xScale(d.y))
          .attr("height", yScale.bandwidth())
          .attr("fill", color);
      }
    },
    [data, width, height, color, direction],
  );

  return <svg ref={ref} width={width} height={height} className={className} />;
}
