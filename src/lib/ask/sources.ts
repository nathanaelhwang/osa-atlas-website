/** Shapes of the public/data files the ask router reads (only the fields it uses). */

export interface FeatureRegistry {
  columns: {
    feature_id: string[];
    feature_name: string[];
    category: string[];
    prevalence: boolean[];
    incidence: boolean[];
    alternate_names: string[][];
  };
}

export interface WasFeatureRegistry {
  columns: {
    feature_key: string[];
    feature_id: string[];
    feature_name: string[];
    family: string[];
    analysis_ids: string[][];
    category: string[];
    subgroup: (string | null)[];
    code_system: string[];
    alternate_names: string[][];
    windows: string[][];
  };
}

export type CurveView = "severity" | "cpap";

export interface SurvivalManifest {
  defaults: { feature_id: string | number; window_days: number };
  strata: { cpap_window_order: number[] };
  features: { feature_id: string | number; feature_name: string; available_views: Partial<Record<CurveView, boolean>> }[];
}

export interface PhenotypesSource {
  octants: { id: string; label: string; summary: string }[];
  survival: {
    levels: {
      id: "phecode" | "system";
      outcomes: { outcome_id: string; outcome_name: string; panels: { octant: string; p: number | null }[] }[];
    }[];
  };
}
