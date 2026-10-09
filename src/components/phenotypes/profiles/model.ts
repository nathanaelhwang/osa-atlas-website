import { formatPct } from "@/lib/data/format";

export type ProfileView = "profile" | "heatmap";

export interface OctantSummary {
  id: string;
  label: string;
  color: string;
  bits: number[];
  n: number;
  pct: number;
  medianAhi: number | null;
  medianCodes: number | null;
  summary: string;
}

export interface MeasureCell {
  estimate: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
  n: number | null;
  smd: number | null;
  suppressed: boolean;
}

export interface Measure {
  id: string;
  label: string;
  /** Binary proportions and fraction-valued measures display as percents. */
  percent: boolean;
  /** Suffix appended to non-percent values ("/h", " y"); "" when the unit adds nothing. */
  unit: string;
  overall: MeasureCell;
  byOctant: Record<string, MeasureCell>;
}

export interface MeasureDomain {
  id: string;
  label: string;
  measures: Measure[];
}

export interface CpapSetup {
  windows: { id: string; label: string }[];
  /** group id (octant id or "overall") → window id → documented setup, in percent (0–100); null when suppressed. */
  setupPct: Record<string, Record<string, number | null>>;
}

export interface ProfilesData {
  octants: OctantSummary[];
  domains: MeasureDomain[];
  cpap: CpapSetup;
}

/** Measure value as displayed: percent for proportions, 1 dp at ≥10 else 2 dp, with the measure's unit suffix. */
export function formatMeasure(value: number | null, measure: Measure, withUnit = true): string {
  if (measure.percent) return formatPct(value, 1);
  if (value === null || !Number.isFinite(value)) return "—";
  const text = value.toFixed(Math.abs(value) >= 10 ? 1 : 2);
  return withUnit ? `${text}${measure.unit}` : text;
}

/** Signed standardized difference, 2 dp, typographic minus. */
export function formatSmd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

/** Median [Q1–Q3] for continuous measures; null when no median is released. */
export function formatSpread(cell: MeasureCell, measure: Measure): string | null {
  if (cell.median === null) return null;
  return `Median ${formatMeasure(cell.median, measure, false)} [${formatMeasure(cell.q1, measure, false)}–${formatMeasure(cell.q3, measure, false)}]`;
}

const NEGATIVE_RGB = [0x2b, 0x6c, 0xb0];
const POSITIVE_RGB = [0xc0, 0x39, 0x2b];

/** Diverging fill: #2b6cb0 at −1, white at 0, #c0392b at +1 (clamped). `dark` marks fills that need white text. */
export function smdFill(smd: number): { color: string; dark: boolean } {
  const t = Math.max(-1, Math.min(1, smd));
  const end = t < 0 ? NEGATIVE_RGB : POSITIVE_RGB;
  const weight = Math.abs(t);
  const [r, g, b] = end.map((channel) => Math.round(255 + (channel - 255) * weight));
  return { color: `rgb(${r} ${g} ${b})`, dark: weight > 0.55 };
}
