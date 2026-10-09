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
const PARALLAX_PX = 8;
/** Per-frame approach toward the pointer target. */
const PARALLAX_EASE = 0.1;

/** Clears the ask box so its text stays legible without hiding the plot. */
const VEIL_STYLE: CSSProperties = {
  background:
    "radial-gradient(max(46%, 320px) max(30%, 220px) at 50% 47%, rgb(255 255 255 / 0.92), rgb(255 255 255 / 0.65) 45%, rgb(255 255 255 / 0) 100%)",
};

/** Plot-space point: x, y in [0, 1]; depth scales parallax. */
interface Dot {
  x: number;
  y: number;
  r: number;
  alpha: number;
  color: string;
  depth: number;
}

/** The load moment plays once per page session, not on every return to home. */
let introPlayed = false;

/** Significance sets size, opacity, and depth; sorted so significant points draw on top. */
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
    if (row.sigBon) return { x, y, r: 3.5 + 1.5 * y, alpha: 1, color, depth: 1 };
    if (row.sigFdr) return { x, y, r: 2.5, alpha: 0.75, color, depth: 0.6 };
    return { x, y, r: 1.6, alpha: 0.3, color, depth: 0.3 };
  });
  return dots.sort((a, b) => a.depth - b.depth);
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
  const offset = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };

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
      ctx.arc(
        side + dot.x * plotWidth - offset.x * dot.depth,
        baseline - dot.y * span * eased - offset.y * dot.depth,
        dot.r * scale,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    }
  };

  const frame = (now: number) => {
    raf = 0;
    offset.x += (target.x - offset.x) * PARALLAX_EASE;
    offset.y += (target.y - offset.y) * PARALLAX_EASE;
    const settled = Math.abs(target.x - offset.x) < 0.05 && Math.abs(target.y - offset.y) < 0.05;
    if (settled) {
      offset.x = target.x;
      offset.y = target.y;
    }
    const introRunning = introStart !== null && now - introStart < STAGGER_MS + RISE_MS;
    draw(now);
    if (!introRunning) introStart = null;
    if (introRunning || !settled) raf = requestAnimationFrame(frame);
  };

  const request = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch" || width === 0 || height === 0) return;
    target.x = (event.clientX / width - 0.5) * 2 * PARALLAX_PX;
    target.y = (event.clientY / height - 0.5) * 2 * PARALLAX_PX;
    request();
  };

  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget !== null) return;
    target.x = 0;
    target.y = 0;
    request();
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
    if (reduced) {
      draw(performance.now());
      return;
    }
    if (!introPlayed) {
      introPlayed = true;
      introStart = performance.now();
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    request();
  });

  return () => {
    cancelled = true;
    observer.disconnect();
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerout", onPointerOut);
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
