"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { loadPartition } from "@/lib/data/client";
import type { AssocRow } from "@/lib/data/types";
import { categoryColor, categoryOrder } from "@/lib/palettes";
import { manhattanLayout, yCap } from "@/lib/plot/manhattan";
import { useReducedMotion } from "./useReducedMotion";

/** Manuscript Figure 1: prevalence, fully adjusted, AHI ≥5 vs <5. */
const PARTITION = "phedas/prevalence/m4/ahi_ge5.json";
/** Share of the viewport height kept clear above the tallest peak. */
const PLOT_TOP = 0.2;
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
  x: number;
  y: number;
  r: number;
  alpha: number;
  color: string;
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
    if (row.sigBon) return { x, y, r: 3.5 + 1.5 * y, alpha: 1, color };
    if (row.sigFdr) return { x, y, r: 2.5, alpha: 0.75, color };
    return { x, y, r: 1.6, alpha: 0.3, color };
  });
  return dots.sort((a, b) => a.alpha - b.alpha);
}

/** Draws and animates the plot on `canvas`; returns the teardown. */
function runBackground(canvas: HTMLCanvasElement, reduced: boolean): (() => void) | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let dots: Dot[] | null = null;
  let width = 0;
  let height = 0;
  let introStart: number | null = null;
  let raf = 0;
  let cancelled = false;

  const draw = (now: number) => {
    if (!dots || width === 0 || height === 0) return;
    const side = Math.max(16, width * 0.03);
    const plotWidth = width - 2 * side;
    const baseline = height - Math.max(24, height * 0.06);
    const span = baseline - height * PLOT_TOP;
    const scale = Math.min(1, Math.max(0.75, width / 1280));
    ctx.clearRect(0, 0, width, height);
    for (const dot of dots) {
      let rise = 1;
      if (introStart !== null) {
        rise = Math.min(1, Math.max(0, (now - introStart - dot.x * STAGGER_MS) / RISE_MS));
        if (rise === 0) continue;
      }
      const eased = 1 - (1 - rise) ** 3;
      ctx.globalAlpha = dot.alpha * Math.min(1, rise * 3);
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(side + dot.x * plotWidth, baseline - dot.y * span * eased, dot.r * scale, 0, 2 * Math.PI);
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
    draw(performance.now());
  });
  observer.observe(canvas);

  loadPartition(PARTITION).then((partition) => {
    if (cancelled) return;
    dots = toDots(partition.rows);
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
  };
}

/** Full-bleed PheWAS Manhattan plot behind the home page; texture only, no text. */
export function HomeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (canvasRef.current) return runBackground(canvasRef.current, reduced);
  }, [reduced]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0" style={VEIL_STYLE} />
    </div>
  );
}
