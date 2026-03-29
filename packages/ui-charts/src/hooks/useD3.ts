import { useRef, useEffect, type RefObject } from 'react';
import * as d3 from 'd3';

/**
 * Attaches a D3 render function to an SVG ref and handles cleanup on re-render.
 *
 * @param renderFn - D3 imperative render callback; receives the SVG selection.
 * @param deps - React dependency array that triggers re-render.
 * @returns A ref to attach to the SVG element.
 */
export function useD3<T extends SVGSVGElement>(
  renderFn: (svg: d3.Selection<T, unknown, null, undefined>) => void,
  deps: React.DependencyList
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    renderFn(d3.select(ref.current) as d3.Selection<T, unknown, null, undefined>);
    return () => {
      if (ref.current) {
        d3.select(ref.current).selectAll('*').remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
