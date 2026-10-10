"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PlotTooltip } from "@/components/charts/plot-shared";
import { loadPartition } from "@/lib/data/client";
import type { AssocRow, EffectType } from "@/lib/data/types";
import { categoryColor, categoryLabel, categoryOrder } from "@/lib/palettes";
import { manhattanLayout, yCap } from "@/lib/plot/manhattan";
import { useReducedMotion } from "./useReducedMotion";

/** Manuscript Figure 1: prevalence, fully adjusted, AHI ≥5 vs <5. */
const PARTITION = "phedas/prevalence/m4/ahi_ge5.json";
/** Share of the viewport height kept clear above the tallest peak. */
const PLOT_TOP = 0.2;
/** Inset from the left, right and bottom edges: the largest marker radius, so the plot runs edge to edge without clipping. */
const EDGE = 6;
const HOVER_RADIUS = 14;
/** The rise sweeps left to right: each point starts `x * STAGGER_MS` in and takes `RISE_MS`. */
const STAGGER_MS = 600;
const RISE_MS = 800;

/** Clears the ask box so its text stays legible without hiding the plot. */
const VEIL_STYLE: CSSProperties = {
  background:
    "radial-gradient(max(46%, 320px) max(30%, 220px) at 50% 47%, rgb(255 255 255 / 0.92), rgb(255 255 255 / 0.65) 45%, rgb(255 255 255 / 0) 100%)",
};

/** Plot-space point: x, y in [0, 1]. */
interface Dot {
  row: AssocRow;
  x: number;
  y: number;
  r: number;
  alpha: number;
  color: string;
}

/** The hovered dot in viewport pixels. */
interface Hover {
  dot: Dot;
  x: number;
  y: number;
  r: number;
  effectType: EffectType;
}

/** The load moment plays once per page session, not on every return to home. */
let introPlayed = false;

/** Significance sets size and opacity; sorted so significant points draw on top. */
function toDots(rows: AssocRow[]): Dot[] {
  const plotted = rows.filter((r) => r.nlp !== null || r.pZero);
  const { cap } = yCap(plotted);
  const order = categoryOrder(
    "phecode",
    plotted.map((r) => r.category),
  );
  const { points } = manhattanLayout(
    plotted,
    (r) => r.category,
    (r) => r.id,
    order,
  );
  const dots = points.map(({ row, x }): Dot => {
    // nlp is null only for p === 0 rows here, which sit at the cap.
    const y = row.nlp === null ? 1 : Math.min(row.nlp, cap) / cap;
    const color = categoryColor("phecode", row.category);
    if (row.sigBon) return { row, x, y, r: 3.5 + 1.5 * y, alpha: 1, color };
    if (row.sigFdr) return { row, x, y, r: 2.5, alpha: 0.75, color };
    return { row, x, y, r: 1.6, alpha: 0.3, color };
  });
  return dots.sort((a, b) => a.alpha - b.alpha);
}

/** Draws and animates the plot on `canvas` and reports the dot under a mouse pointer; returns the teardown. */
function runBackground(
  canvas: HTMLCanvasElement,
  reduced: boolean,
  onHover: (hover: Hover | null) => void,
): (() => void) | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let dots: Dot[] | null = null;
  let effectType: EffectType = "OR";
  let width = 0;
  let height = 0;
  let introStart: number | null = null;
  let raf = 0;
  let cancelled = false;
  let hovered: Dot | null = null;

  /** Marker size factor: dots shrink on narrow viewports, to 75% at most. */
  const scale = () => Math.min(1, Math.max(0.75, width / 1280));
  /** Viewport position of `dot` once `rise` (0–1, eased) of its intro has played. */
  const position = (dot: Dot, rise = 1) => {
    const baseline = height - EDGE;
    const span = baseline - height * PLOT_TOP;
    return { x: EDGE + dot.x * (width - 2 * EDGE), y: baseline - dot.y * span * rise };
  };

  const setHovered = (dot: Dot | null) => {
    if (dot === hovered) return;
    hovered = dot;
    if (!dot) return onHover(null);
    const { x, y } = position(dot);
    onHover({ dot, x, y, r: Math.max(3.5, dot.r * scale()), effectType });
  };

  const draw = (now: number) => {
    if (!dots || width === 0 || height === 0) return;
    const dotScale = scale();
    ctx.clearRect(0, 0, width, height);
    for (const dot of dots) {
      let rise = 1;
      if (introStart !== null) {
        rise = Math.min(1, Math.max(0, (now - introStart - dot.x * STAGGER_MS) / RISE_MS));
        if (rise === 0) continue;
      }
      const { x, y } = position(dot, 1 - (1 - rise) ** 3);
      ctx.globalAlpha = dot.alpha * Math.min(1, rise * 3);
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(x, y, dot.r * dotScale, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  const frame = (now: number) => {
    raf = 0;
    const introRunning = introStart !== null && now - introStart < STAGGER_MS + RISE_MS;
    draw(now);
    if (introRunning) raf = requestAnimationFrame(frame);
    else introStart = null;
  };

  // Resizing clears the bitmap; redraw synchronously (observer callbacks run before paint) to avoid a blank frame.
  const observer = new ResizeObserver(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setHovered(null);
    draw(performance.now());
  });
  observer.observe(canvas);

  // Nearest dot within HOVER_RADIUS; dots are in draw order, so ties resolve to the one drawn on top. Touch has no hover.
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch" || !dots || introStart !== null) return setHovered(null);
    const bounds = canvas.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const py = event.clientY - bounds.top;
    let best: Dot | null = null;
    let bestDistance = HOVER_RADIUS * HOVER_RADIUS;
    for (const dot of dots) {
      const { x, y } = position(dot);
      const distance = (x - px) ** 2 + (y - py) ** 2;
      if (distance <= bestDistance) {
        best = dot;
        bestDistance = distance;
      }
    }
    setHovered(best);
  };
  const onPointerLeave = () => setHovered(null);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  loadPartition(PARTITION).then((partition) => {
    if (cancelled) return;
    dots = toDots(partition.rows);
    effectType = partition.effectType;
    if (!reduced && !introPlayed) {
      introPlayed = true;
      introStart = performance.now();
      raf = requestAnimationFrame(frame);
      return;
    }
    draw(performance.now());
  });

  return () => {
    cancelled = true;
    observer.disconnect();
    cancelAnimationFrame(raf);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    onHover(null);
  };
}

/** Full-bleed PheWAS Manhattan plot behind the home page; no text except the hover card. */
export function HomeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    if (canvasRef.current) return runBackground(canvasRef.current, reduced, setHover);
  }, [reduced]);

  return (
    <div aria-hidden className="fixed inset-0 z-0">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0" style={VEIL_STYLE} />
      {hover && (
        <div className="pointer-events-none absolute inset-0">
          <span
            className="absolute rounded-full border border-ink"
            style={{
              left: hover.x - hover.r,
              top: hover.y - hover.r,
              width: 2 * hover.r,
              height: 2 * hover.r,
              backgroundColor: hover.dot.color,
            }}
          />
          <PlotTooltip
            row={hover.dot.row}
            color={hover.dot.color}
            left={hover.x}
            top={hover.y}
            containerWidth={window.innerWidth}
            category={categoryLabel("phecode", hover.dot.row.category)}
            effectType={hover.effectType}
          />
        </div>
      )}
    </div>
  );
}
