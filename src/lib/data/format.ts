import type { EffectType } from "@/lib/data/types";

const DASH = "—";
const MINUS = "−";

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

const INT_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "4.24 × 10⁻¹⁵⁴" below 0.001, "0.032" otherwise, "< 10⁻³⁰⁸" for underflow, "—" for null. */
export function formatP(p: number | null, pZero?: boolean): string {
  if (pZero || p === 0) return "< 10⁻³⁰⁸";
  if (p === null || !Number.isFinite(p)) return DASH;
  if (p >= 0.001) return p.toPrecision(2);
  const [mantissa, exponent] = p.toExponential(2).split("e");
  const superExponent = Array.from(String(Number(exponent)), (ch) => SUPERSCRIPT[ch] ?? ch).join("");
  return `${mantissa} × 10${superExponent}`;
}

/** Ratios 2 dp (3 significant digits below 0.1), β 3 dp, Wald statistics 1 dp. */
export function formatEffect(v: number | null, type: EffectType): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  let text: string;
  switch (type) {
    case "OR":
    case "HR":
    case "IRR":
      text = Math.abs(v) < 0.1 ? v.toPrecision(3) : v.toFixed(2);
      break;
    case "beta":
      text = v.toFixed(3);
      break;
    case "wald_F":
    case "wald_chi2":
      text = v.toFixed(1);
      break;
  }
  return text.replace("-", MINUS);
}

/** "1.53–1.63"; "−0.120 to 0.050" when the lower bound is negative; "—" when either bound is missing. */
export function formatCI(lo: number | null, hi: number | null, type: EffectType): string {
  if (lo === null || hi === null || !Number.isFinite(lo) || !Number.isFinite(hi)) return DASH;
  const separator = lo < 0 ? " to " : "–";
  return `${formatEffect(lo, type)}${separator}${formatEffect(hi, type)}`;
}

/** "7,068" or "—". */
export function formatInt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return DASH;
  return INT_FORMAT.format(n);
}

/** Fraction in [0, 1] → "12.3%" (default 1 decimal), or "—". */
export function formatPct(v: number | null, digits = 1): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  return `${(v * 100).toFixed(digits)}%`;
}
