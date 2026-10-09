import type { EffectType } from "@/lib/data/types";

export const CONTRAST_ORDER: string[] = [
  "ahi_ge5",
  "ahi_ge15",
  "mild_vs_none",
  "moderate_vs_none",
  "severe_vs_none",
  "trend",
  "omnibus",
];

export const CONTRAST_LABELS: Record<string, string> = {
  ahi_ge5: "AHI ≥5 vs <5",
  ahi_ge15: "AHI ≥15 vs <15",
  mild_vs_none: "Mild vs none",
  moderate_vs_none: "Moderate vs none",
  severe_vs_none: "Severe vs none",
  trend: "Severity trend",
  omnibus: "Any severity difference",
};

export const MODEL_LABELS: Record<string, string> = {
  M1: "M1 Unadjusted",
  M2: "M2 Demographics",
  M3: "M3 + Smoking, income",
  M4: "M4 Fully adjusted",
};

export const WINDOW_LABELS: Record<string, string> = {
  "1yr": "1 year",
  "5yr": "5 years",
  lifetime: "Lifetime",
  index: "At sleep study",
};

export const EFFECT_LABELS: Record<EffectType, { short: string; long: string }> = {
  OR: { short: "OR", long: "Odds ratio" },
  HR: { short: "HR", long: "Hazard ratio" },
  IRR: { short: "IRR", long: "Rate ratio" },
  beta: { short: "β", long: "Standardized β" },
  wald_F: { short: "F", long: "Wald F" },
  wald_chi2: { short: "χ²", long: "Wald χ²" },
};
