export type EffectType = "OR" | "HR" | "IRR" | "beta" | "wald_F" | "wald_chi2";

export interface AssocRow {
  /** feature_key (WAS) or feature_id (PheDAS); unique within a partition */
  key: string;
  /** feature_id as string */
  id: string;
  name: string;
  category: string;
  subgroup: string | null;
  effect: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  se: number | null;
  p: number | null;
  /** -log10 p; recomputed from p when source neglog10p is null and p > 0; null when p is null or p === 0 */
  nlp: number | null;
  /** p === 0 (numeric underflow; plot at the y cap) */
  pZero: boolean;
  sigFdr: boolean;
  sigBon: boolean;
  unstable: boolean;
  /** WAS n, or incidence n_atrisk */
  n: number | null;
  /** incidence n_events */
  nEvents: number | null;
}

export interface Partition {
  /** relative to /data/ */
  path: string;
  effectType: EffectType;
  /** source effect_scale or derived ("odds ratio", "hazard ratio") */
  effectScale: string;
  /** 1 for OR/HR/IRR, 0 otherwise */
  neutral: number;
  /** false for wald_F / wald_chi2 (omnibus) */
  directional: boolean;
  /** true for OR/HR/IRR */
  logScale: boolean;
  rows: AssocRow[];
  /** smallest finite nlp among sigBon rows (threshold line); null if none */
  bonferroniNlp: number | null;
}
