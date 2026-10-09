"use client";

import { bisector, max } from "d3-array";
import { scaleLinear } from "d3-scale";
import { area, curveStepAfter, line } from "d3-shape";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";

export interface CifSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  muted?: boolean;
  /** y in percent (0–100). */
  points: { t: number; y: number }[];
  band?: { t: number; lo: number; hi: number }[];
}

const MARGIN = { top: 28, right: 16, bottom: 44, left: 44 };
const byT = bisector<{ t: number }, number>((point) => point.t);

/** Step-function value: last point with t ≤ hovered t. */
function valueAt(points: { t: number; y: number }[], t: number): number | null {
  const index = byT.right(points, t) - 1;
  return index >= 0 ? points[index].y : null;
}

export function CifChart(props: {
  series: CifSeries[];
  ariaLabel: string;
  xMax?: number;
  yLabel?: string;
  xLabel?: string;
  height?: number;
}) {
  const { series, ariaLabel, xMax, yLabel = "Cumulative incidence (%)", xLabel = "Years", height = 360 } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const clipId = `cif-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [width, setWidth] = useState(0);
  const [hoverT, setHoverT] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const tMax = xMax ?? max(series, (s) => max(s.points, (point) => point.t)) ?? 0;
  const yMaxData =
    max(series, (s) =>
      Math.max(
        max(s.points, (point) => (point.t <= tMax ? point.y : 0)) ?? 0,
        max(s.band ?? [], (band) => (band.t <= tMax ? band.hi : 0)) ?? 0,
      ),
    ) ?? 0;

  const x = scaleLinear()
    .domain([0, tMax > 0 ? tMax : 1])
    .range([0, innerWidth]);
  const y = scaleLinear()
    .domain([0, yMaxData > 0 ? yMaxData : 1])
    .nice(5)
    .range([innerHeight, 0]);
  const xTicks = x.ticks(Math.max(2, Math.floor(innerWidth / 80)));
  const yTicks = y.ticks(5);
  const xTickFormat = x.tickFormat(xTicks.length);
  const yTickFormat = y.tickFormat(5);

  const linePath = line<{ t: number; y: number }>()
    .x((point) => x(point.t))
    .y((point) => y(point.y))
    .curve(curveStepAfter);
  const bandPath = area<{ t: number; lo: number; hi: number }>()
    .x((band) => x(band.t))
    .y0((band) => y(band.lo))
    .y1((band) => y(band.hi))
    .curve(curveStepAfter);

  // Muted series first so emphasized series draw on top.
  const drawOrder = [...series].sort((a, b) => Number(!a.muted) - Number(!b.muted));

  const updateHover = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const t = x.invert(event.clientX - bounds.left);
    setHoverT(Math.min(x.domain()[1], Math.max(0, t)));
  };

  const hoverX = hoverT === null ? null : x(hoverT);
  const tooltipOnLeft = hoverX !== null && MARGIN.left + hoverX > width / 2;

  return (
    <div ref={containerRef} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg role="img" aria-label={ariaLabel} width={width} height={height} className="block touch-pan-y overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={-2} width={innerWidth} height={innerHeight + 4} />
            </clipPath>
          </defs>

          <text x={0} y={12} className="fill-muted text-[12px]">
            {yLabel}
          </text>
          <text x={MARGIN.left + innerWidth / 2} y={height - 6} textAnchor="middle" className="fill-muted text-[12px]">
            {xLabel}
          </text>

          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {yTicks.map((tick) => (
              <g key={tick} transform={`translate(0,${y(tick)})`}>
                <line
                  x1={0}
                  x2={innerWidth}
                  className={tick === 0 ? "stroke-hairline" : "stroke-hairline-soft"}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={-10} dy="0.32em" textAnchor="end" className="fill-muted text-[12px] tabular-nums">
                  {yTickFormat(tick)}
                </text>
              </g>
            ))}
            {xTicks.map((tick) => (
              <text
                key={tick}
                x={x(tick)}
                y={innerHeight + 20}
                textAnchor="middle"
                className="fill-muted text-[12px] tabular-nums"
              >
                {xTickFormat(tick)}
              </text>
            ))}

            <g clipPath={`url(#${clipId})`}>
              {drawOrder.map((s) =>
                s.band && s.band.length > 0 ? (
                  <path
                    key={`${s.id}-band`}
                    d={bandPath(s.band) ?? undefined}
                    fill={s.color}
                    fillOpacity={s.muted ? 0.05 : 0.12}
                    stroke="none"
                  />
                ) : null,
              )}
              {drawOrder.map((s) => (
                <path
                  key={s.id}
                  d={linePath(s.points) ?? undefined}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.muted ? 1.5 : 2}
                  strokeOpacity={s.muted ? 0.35 : 1}
                  strokeDasharray={s.dashed ? "6 4" : undefined}
                  strokeLinejoin="round"
                />
              ))}
            </g>

            {hoverT !== null && hoverX !== null && (
              <g pointerEvents="none">
                <line x1={hoverX} x2={hoverX} y1={0} y2={innerHeight} className="stroke-hairline" strokeWidth={1} />
                {drawOrder.map((s) => {
                  const value = valueAt(s.points, hoverT);
                  return value === null ? null : (
                    <circle
                      key={s.id}
                      cx={hoverX}
                      cy={y(value)}
                      r={3.5}
                      fill={s.color}
                      fillOpacity={s.muted ? 0.35 : 1}
                      className="stroke-canvas"
                      strokeWidth={1.5}
                    />
                  );
                })}
              </g>
            )}

            <rect
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onPointerDown={updateHover}
              onPointerMove={updateHover}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") setHoverT(null);
              }}
            />
          </g>
        </svg>
      )}

      {hoverT !== null && hoverX !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 min-w-[160px] rounded-[12px] border border-hairline-soft bg-canvas px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
          style={{
            top: MARGIN.top + 8,
            left: MARGIN.left + hoverX + (tooltipOnLeft ? -12 : 12),
            transform: tooltipOnLeft ? "translateX(-100%)" : undefined,
          }}
        >
          <p className="text-[12px] text-muted tabular-nums">
            {hoverT.toFixed(1)} {xLabel.toLowerCase()}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {series.map((s) => {
              const value = valueAt(s.points, hoverT);
              return (
                <li
                  key={s.id}
                  className={`flex items-center gap-2 text-[12px] ${s.muted ? "text-muted" : "text-ink"}`}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color, opacity: s.muted ? 0.35 : 1 }}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  <span className="font-medium tabular-nums">{value === null ? "—" : `${value.toFixed(1)}%`}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
