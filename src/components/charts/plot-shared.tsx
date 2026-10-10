"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { formatEffect, formatP } from "@/lib/data/format";
import { EFFECT_LABELS } from "@/lib/data/labels";
import type { AssocRow, EffectType, Partition } from "@/lib/data/types";

export interface AssocPlotProps {
  /** Already filtered by the template; plots skip rows with nlp null && !pZero. */
  rows: AssocRow[];
  partition: Pick<Partition, "effectType" | "directional" | "neutral" | "logScale" | "bonferroniNlp">;
  colorOf: (row: AssocRow) => string;
  /** Manhattan x grouping (category or subgroup). */
  groupOf: (row: AssocRow) => string;
  groupOrder: string[];
  groupLabel: (group: string) => string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Default 460 (≥lg), 420 (sm–lg), 360 (<sm). */
  height?: number;
}

export interface PlotMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type MarkerShape = "up" | "down" | "circle";

/** A marker in inner-plot screen coordinates. */
export interface PlotPoint {
  row: AssocRow;
  x: number;
  y: number;
  color: string;
  shape: MarkerShape;
  size: number;
  opacity: number;
  outlined: boolean;
  /** 0 not significant, 1 FDR, 2 Bonferroni; draw order. */
  tier: 0 | 1 | 2;
}

/** Threshold lines and the selection guide. */
export const GUIDE_COLOR = "#86868b";
const OUTLINE = "rgba(0,0,0,0.55)";
const TIER_SIZE = [5, 7, 9] as const;
const HOVER_RADIUS = 14;
const TOUCH_RADIUS = 24;

const TOOLTIP_WIDTH = 260;
const TOOLTIP_OFFSET = 12;
const VIEWPORT_QUERIES = ["(min-width: 1024px)", "(min-width: 640px)"] as const;

function subscribeViewport(onChange: () => void): () => void {
  const lists = VIEWPORT_QUERIES.map((query) => window.matchMedia(query));
  for (const list of lists) list.addEventListener("change", onChange);
  return () => {
    for (const list of lists) list.removeEventListener("change", onChange);
  };
}

function viewportHeight(): number {
  if (window.matchMedia(VIEWPORT_QUERIES[0]).matches) return 460;
  return window.matchMedia(VIEWPORT_QUERIES[1]).matches ? 420 : 360;
}

/** `height` when given; otherwise a breakpoint default (460 ≥lg, 420 ≥sm, 360 below). */
export function usePlotHeight(height: number | undefined): number {
  const auto = useSyncExternalStore(subscribeViewport, viewportHeight, () => 460);
  return height ?? auto;
}

/** Content width of the referenced element, tracked with a ResizeObserver. */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export function isPlottable(row: AssocRow): boolean {
  return row.nlp !== null || row.pZero;
}

/** −log10 p clamped to the cap; underflowed p sits at the cap. */
export function cappedNlp(row: AssocRow, cap: number): number {
  return row.pZero || row.nlp === null ? cap : Math.min(row.nlp, cap);
}

/** Builds a marker: triangles point with the effect direction, size and outline follow significance. */
export function plotPoint(
  row: AssocRow,
  x: number,
  y: number,
  color: string,
  partition: Pick<Partition, "directional" | "neutral">,
  opacityByTier: readonly [number, number, number],
): PlotPoint {
  const tier = row.sigBon ? 2 : row.sigFdr ? 1 : 0;
  let shape: MarkerShape = "circle";
  if (partition.directional && row.effect !== null && row.effect !== partition.neutral) {
    shape = row.effect > partition.neutral ? "up" : "down";
  }
  return { row, x, y, color, shape, size: TIER_SIZE[tier], opacity: opacityByTier[tier], outlined: tier === 2, tier };
}

/** SVG path for a marker centered at (cx, cy); `size` is the circle diameter, triangles are sized to match visually. */
function markerPath(shape: MarkerShape, cx: number, cy: number, size: number): string {
  if (shape === "circle") {
    const r = size / 2;
    return `M${cx - r},${cy}a${r},${r} 0 1,0 ${size},0a${r},${r} 0 1,0 ${-size},0Z`;
  }
  const side = size * 1.25;
  const h = side * 0.866;
  const tip = shape === "up" ? cy - (2 * h) / 3 : cy + (2 * h) / 3;
  const base = shape === "up" ? cy + h / 3 : cy - h / 3;
  return `M${cx},${tip}L${cx + side / 2},${base}L${cx - side / 2},${base}Z`;
}

const PointLayer = memo(function PointLayer({ points }: { points: PlotPoint[] }) {
  return (
    <g>
      {points.map((point) => (
        <path
          key={point.row.key}
          d={markerPath(point.shape, point.x, point.y, point.size)}
          fill={point.color}
          fillOpacity={point.opacity}
          stroke={point.outlined ? OUTLINE : undefined}
          strokeWidth={point.outlined ? 0.75 : undefined}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
});

/** Gridlines with y tick labels and the axis title above the top-left corner; the top tick reads "≥cap" when values were clamped. */
export function YAxis(props: {
  ticks: number[];
  y: (v: number) => number;
  innerWidth: number;
  margin: PlotMargin;
  cap: number;
  capped: boolean;
}) {
  const { ticks, y, innerWidth, margin, cap, capped } = props;
  return (
    <g>
      <text x={-margin.left} y={12 - margin.top} className="fill-muted text-[12px]">
        −log₁₀ p
      </text>
      {ticks.map((tick) => (
        <g key={tick} transform={`translate(0,${y(tick)})`}>
          <line
            x1={0}
            x2={innerWidth}
            className={tick === 0 ? "stroke-hairline" : "stroke-hairline-soft"}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
          <text x={-8} dy="0.32em" textAnchor="end" className="fill-muted text-[12px] tabular-nums">
            {capped && tick === cap ? `≥${tick}` : tick}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Hover card for a plotted association: name, category, p and effect. `left`/`top` are the marker center in container pixels. */
export function PlotTooltip(props: {
  row: AssocRow;
  color: string;
  left: number;
  top: number;
  containerWidth: number;
  category: string;
  effectType: EffectType;
}) {
  const { row, color, left, top, containerWidth, category, effectType } = props;
  // Prefer the right of the point, then the left; when neither side fits a full-width tooltip, pin it inside the plot.
  const maxWidth = Math.min(TOOLTIP_WIDTH, containerWidth);
  let x: number;
  let translateX = "0";
  if (left + TOOLTIP_OFFSET + maxWidth <= containerWidth) {
    x = left + TOOLTIP_OFFSET;
  } else if (left - TOOLTIP_OFFSET - maxWidth >= 0) {
    x = left - TOOLTIP_OFFSET;
    translateX = "-100%";
  } else {
    x = containerWidth - maxWidth;
  }
  const translateY = top < 110 ? `${TOOLTIP_OFFSET}px` : `calc(-100% - ${TOOLTIP_OFFSET}px)`;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 w-max rounded-[12px] border border-hairline-soft bg-canvas px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
      style={{ left: x, top, maxWidth, transform: `translate(${translateX},${translateY})` }}
    >
      <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-ink">{row.name}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{category}</span>
      </p>
      <p className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-ink tabular-nums">
        <span>p {formatP(row.p, row.pZero)}</span>
        <span>
          {EFFECT_LABELS[effectType].short} {formatEffect(row.effect, effectType)}
        </span>
      </p>
    </div>
  );
}

/**
 * Interactive shell shared by the Manhattan and volcano plots: one memoized marker layer, a hover/selection overlay,
 * nearest-point hit testing, tooltip, click/tap selection and arrow-key navigation over `points` (given in navigation order).
 */
export function AssocPlotCanvas(props: {
  containerRef: RefObject<HTMLDivElement | null>;
  width: number;
  height: number;
  margin: PlotMargin;
  points: PlotPoint[];
  /** Drawn beneath the markers, inside the inner plot group. */
  backdrop: ReactNode;
  /** Drawn above the markers and below the hover/selection overlay (labels that must stay legible). */
  foreground?: ReactNode;
  ariaLabel: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  effectType: EffectType;
  categoryOf: (row: AssocRow) => string;
  /** Inner y of the baseline for a dashed guide below the selected marker; null for none. */
  guideTo: number | null;
}) {
  const { containerRef, width, height, margin, points, backdrop, foreground, ariaLabel, selectedKey, onSelect } = props;
  const { effectType, categoryOf, guideTo } = props;
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const frame = useRef<number | null>(null);
  const pendingPointer = useRef<{ x: number; y: number } | null>(null);
  const pointerType = useRef("mouse");

  const drawOrder = useMemo(() => [...points].sort((a, b) => a.tier - b.tier), [points]);
  const byKey = useMemo(() => new Map(points.map((point) => [point.row.key, point])), [points]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // Later markers draw on top, so ties resolve to the visible one.
  const nearest = (x: number, y: number, radius: number): PlotPoint | null => {
    let best: PlotPoint | null = null;
    let bestDistance = radius * radius;
    for (const point of drawOrder) {
      const dx = point.x - x;
      const dy = point.y - y;
      const distance = dx * dx + dy * dy;
      if (distance <= bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    return best;
  };

  const innerPosition = (event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left - margin.left, y: event.clientY - bounds.top - margin.top };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    pendingPointer.current = innerPosition(event);
    setKeyboardActive(false);
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const position = pendingPointer.current;
      if (!position) return;
      setHoverKey(nearest(position.x, position.y, HOVER_RADIUS)?.row.key ?? null);
    });
  };

  const onPointerLeave = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pendingPointer.current = null;
    setHoverKey(null);
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const position = innerPosition(event);
    const hit = nearest(position.x, position.y, pointerType.current === "touch" ? TOUCH_RADIUS : HOVER_RADIUS);
    if (hit) onSelect(hit.row.key);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (points.length === 0) return;
    const current = selectedKey === null ? -1 : points.findIndex((point) => point.row.key === selectedKey);
    const last = points.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = current < 0 ? 0 : Math.min(last, current + 1);
        break;
      case "ArrowLeft":
        next = current < 0 ? last : Math.max(0, current - 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setHoverKey(null);
    setKeyboardActive(true);
    onSelect(points[next].row.key);
  };

  const selected = selectedKey === null ? undefined : byKey.get(selectedKey);
  const hovered = hoverKey === null ? undefined : byKey.get(hoverKey);
  const tooltipPoint = hovered ?? (keyboardActive ? selected : undefined);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={ariaLabel}
      tabIndex={0}
      className="relative w-full touch-manipulation rounded-[8px] outline-none select-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ height, cursor: hovered ? "pointer" : undefined }}
      onPointerDown={(event) => {
        pointerType.current = event.pointerType;
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onBlur={() => setKeyboardActive(false)}
    >
      {width > 0 && (
        <svg aria-hidden="true" width={width} height={height} className="block overflow-visible">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {backdrop}
            <PointLayer points={drawOrder} />
            {foreground}
            <g pointerEvents="none">
              {selected && guideTo !== null && selected.y + selected.size < guideTo && (
                <line
                  x1={selected.x}
                  x2={selected.x}
                  y1={selected.y + selected.size}
                  y2={guideTo}
                  stroke={GUIDE_COLOR}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}
              {hovered && hovered !== selected && (
                <path
                  d={markerPath(hovered.shape, hovered.x, hovered.y, hovered.size)}
                  fill={hovered.color}
                  stroke="#000"
                  strokeWidth={1}
                  strokeLinejoin="round"
                />
              )}
              {selected && (
                <path
                  d={markerPath(selected.shape, selected.x, selected.y, selected.size * 1.6)}
                  fill={selected.color}
                  stroke="#000"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              )}
            </g>
          </g>
        </svg>
      )}

      {tooltipPoint && (
        <PlotTooltip
          row={tooltipPoint.row}
          color={tooltipPoint.color}
          left={margin.left + tooltipPoint.x}
          top={margin.top + tooltipPoint.y}
          containerWidth={width}
          category={categoryOf(tooltipPoint.row)}
          effectType={effectType}
        />
      )}

      <p aria-live="polite" className="sr-only">
        {keyboardActive && selected ? `${selected.row.name}, p ${formatP(selected.row.p, selected.row.pZero)}` : ""}
      </p>
    </div>
  );
}
