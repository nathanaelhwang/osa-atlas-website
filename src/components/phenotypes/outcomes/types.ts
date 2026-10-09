/** Octant row metadata passed from the server page. */
export interface OutcomeOctant {
  id: string;
  label: string;
  bits: number[];
}

/** M4 one-vs-rest estimate for one octant (from phenotypes.json survival panels). */
export interface OutcomePanel {
  octant: string;
  hr: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  p: number | null;
  sigFdr: boolean;
  sigBon: boolean;
}

export interface OutcomeSummary {
  id: string;
  level: "phecode" | "system";
  name: string;
  category: string;
  /** Curve payload path relative to public/data. */
  path: string;
  panels: OutcomePanel[];
}

export interface CurveArrays {
  time_years: number[];
  cif_pct: number[];
  ci_low_pct: number[];
  ci_high_pct: number[];
}

export interface RiskRow {
  time_years: number;
  n_at_risk: number | null;
  n_events_cum: number | null;
  suppressed: boolean;
}

/** `public/data/phenotype-survival/{level}/{file}.json` (fields used by the page). */
export interface CurvePayload {
  outcome_id: string;
  panels: {
    octant: string;
    curve_status: string;
    curves: { focal: CurveArrays | null; other_seven: CurveArrays | null } | null;
    risk_table: { focal: RiskRow[] | null; other_seven: RiskRow[] | null } | null;
    logrank_p: number | null;
  }[];
  no_osa: {
    curve_status: string;
    curve: CurveArrays | null;
    risk_table: RiskRow[] | null;
    logrank_p: number | null;
  } | null;
}
