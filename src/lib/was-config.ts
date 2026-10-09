import type { PaletteKey } from "@/lib/palettes";

export type WasSlug =
  | "phedas-prevalence"
  | "phedas-incidence"
  | "labwas"
  | "medwas"
  | "procwas"
  | "utilwas"
  | "qwas"
  | "behwas";

export const WAS_FAMILY_SLUGS: WasSlug[] = ["labwas", "medwas", "qwas", "procwas", "utilwas", "behwas"];

export interface WasAnalysisConfig {
  /** "prevalence" | "incidence" | WAS analysis_id */
  id: string;
  /** Measure dropdown label (page title for single-analysis pages) */
  label: string;
  /** [] for PheDAS */
  windows: string[];
  models: string[];
  /** Ordered by CONTRAST_ORDER; only contrasts with partitions */
  contrasts: string[];
  /** `${window}|${model}|${contrast}` → path relative to /data/ (window "" for PheDAS). Only existing partitions. */
  partitions: Record<string, string>;
  palette: PaletteKey;
  colorBy: "category" | "subgroup";
  subgroupLabel: string | null;
}

export interface WasPageConfig {
  slug: WasSlug;
  title: string;
  href: string;
  categoryLabel: string;
  analyses: WasAnalysisConfig[];
  defaults: { analysis: string; window: string; model: string; contrast: string };
  /** PheCodes with incidence curves; [] for non-PheCode pages */
  survivalFeatureIds: string[];
}
