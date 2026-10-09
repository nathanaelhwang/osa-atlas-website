import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { CONTRAST_ORDER } from "@/lib/data/labels";
import type { PaletteKey } from "@/lib/palettes";
import type { WasAnalysisConfig, WasPageConfig, WasSlug } from "@/lib/was-config";

interface AtlasManifest {
  partitions: { analysis: string; model: string; contrast: string; path: string }[];
}

interface WasManifest {
  analyses: { analysis_id: string; family: string }[];
  partitions: { analysis_id: string; window: string; model: string; contrast: string; path: string }[];
}

interface SurvivalManifest {
  features: { feature_id: string | number }[];
}

interface PartitionRef {
  window: string;
  model: string;
  contrast: string;
  path: string;
}

type AnalysisStyle = Pick<WasAnalysisConfig, "palette" | "colorBy" | "subgroupLabel">;

const DATA_DIR = path.join(process.cwd(), "public", "data");
const WINDOW_ORDER = ["1yr", "5yr", "lifetime", "index"];
const MODEL_ORDER = ["M1", "M2", "M3", "M4"];

const PAGES: Record<WasSlug, { title: string; href: string; categoryLabel: string }> = {
  "phedas-prevalence": { title: "PheDAS Prevalence", href: "/phedas/prevalence", categoryLabel: "Body system" },
  "phedas-incidence": { title: "PheDAS Incidence", href: "/phedas/incidence", categoryLabel: "Body system" },
  labwas: { title: "LabWAS", href: "/was/labwas", categoryLabel: "Category" },
  medwas: { title: "MedWAS", href: "/was/medwas", categoryLabel: "Category" },
  procwas: { title: "ProcWAS", href: "/was/procwas", categoryLabel: "Category" },
  utilwas: { title: "UtilWAS", href: "/was/utilwas", categoryLabel: "Body system" },
  qwas: { title: "QWAS", href: "/was/qwas", categoryLabel: "Category" },
  behwas: { title: "BehWAS", href: "/was/behwas", categoryLabel: "Category" },
};

/** Measure dropdown labels; analyses absent here are their family's only analysis and use the page title. */
const ANALYSIS_LABELS: Record<string, string> = {
  labwas_mean: "Mean value",
  labwas_median: "Median value",
  labwas_order_rate: "Order rate",
  labwas_order_propensity: "Any order",
  utilwas_presence: "Diagnosis presence",
  utilwas_count_present: "Diagnosis count",
  utilwas_specialty_rate: "Specialty visits",
  qwas_binary: "Binary",
  qwas_continuous: "Continuous",
  behwas_binary: "Binary",
  behwas_continuous: "Continuous",
};

const ANALYSIS_STYLES: Record<string, AnalysisStyle> = {
  utilwas_presence: { palette: "phecode", colorBy: "category", subgroupLabel: "Setting" },
  utilwas_count_present: { palette: "phecode", colorBy: "category", subgroupLabel: "Setting" },
  utilwas_specialty_rate: { palette: "utilwas_specialty", colorBy: "subgroup", subgroupLabel: null },
};

const FAMILY_PALETTES: Record<string, PaletteKey> = {
  labwas: "labwas",
  medwas: "medwas",
  procwas: "procwas",
  qwas: "qwas",
  behwas: "behwas",
};

const DEFAULT_ANALYSIS: Partial<Record<WasSlug, string>> = {
  labwas: "labwas_median",
  utilwas: "utilwas_presence",
  qwas: "qwas_binary",
  behwas: "behwas_binary",
};

const jsonCache = new Map<string, unknown>();

/** Synchronous, memoized read of a JSON file under public/data. */
export function readPublicJson<T>(relPath: string): T {
  if (!jsonCache.has(relPath)) {
    jsonCache.set(relPath, JSON.parse(readFileSync(path.join(DATA_DIR, relPath), "utf8")));
  }
  return jsonCache.get(relPath) as T;
}

/** Distinct values ordered by `order`; values not in `order` are appended alphabetically. */
function ordered(values: Iterable<string>, order: string[]): string[] {
  const rank = (v: string) => {
    const i = order.indexOf(v);
    return i === -1 ? order.length : i;
  };
  return [...new Set(values)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** `preferred` when available, else the first option ("" when there are none, e.g. PheDAS windows). */
function pick(preferred: string, options: string[]): string {
  return options.includes(preferred) ? preferred : (options[0] ?? "");
}

function buildAnalysis(id: string, label: string, refs: PartitionRef[], style: AnalysisStyle): WasAnalysisConfig {
  const partitions: Record<string, string> = {};
  for (const ref of refs) partitions[`${ref.window}|${ref.model}|${ref.contrast}`] = ref.path;
  return {
    id,
    label,
    windows: ordered(refs.map((r) => r.window).filter((w) => w !== ""), WINDOW_ORDER),
    models: ordered(refs.map((r) => r.model), MODEL_ORDER),
    contrasts: ordered(refs.map((r) => r.contrast), CONTRAST_ORDER),
    partitions,
    ...style,
  };
}

function buildAnalyses(slug: WasSlug): WasAnalysisConfig[] {
  const { title } = PAGES[slug];
  if (slug === "phedas-prevalence" || slug === "phedas-incidence") {
    const analysis = slug === "phedas-prevalence" ? "prevalence" : "incidence";
    const refs = readPublicJson<AtlasManifest>("atlas-manifest.json")
      .partitions.filter((p) => p.analysis === analysis)
      .map((p) => ({ window: "", model: p.model, contrast: p.contrast, path: p.path }));
    return [buildAnalysis(analysis, title, refs, { palette: "phecode", colorBy: "category", subgroupLabel: null })];
  }

  const manifest = readPublicJson<WasManifest>("was-manifest.json");
  return manifest.analyses
    .filter((a) => a.family === slug)
    .map((a) =>
      buildAnalysis(
        a.analysis_id,
        ANALYSIS_LABELS[a.analysis_id] ?? title,
        manifest.partitions.filter((p) => p.analysis_id === a.analysis_id),
        ANALYSIS_STYLES[a.analysis_id] ?? { palette: FAMILY_PALETTES[slug], colorBy: "category", subgroupLabel: null },
      ),
    );
}

export function getWasPageConfig(slug: WasSlug): WasPageConfig {
  const page = PAGES[slug];
  const analyses = buildAnalyses(slug);
  const defaultAnalysis = analyses.find((a) => a.id === DEFAULT_ANALYSIS[slug]) ?? analyses[0];
  if (!defaultAnalysis) throw new Error(`No partitions found for WAS page "${slug}"`);

  const phecodeBased = slug === "phedas-prevalence" || slug === "phedas-incidence" || slug === "utilwas";
  const survivalFeatureIds = phecodeBased
    ? readPublicJson<SurvivalManifest>("survival-manifest.json").features.map((f) => String(f.feature_id))
    : [];

  return {
    slug,
    title: page.title,
    href: page.href,
    categoryLabel: page.categoryLabel,
    analyses,
    defaults: {
      analysis: defaultAnalysis.id,
      window: pick("5yr", defaultAnalysis.windows),
      model: pick("M4", defaultAnalysis.models),
      contrast: pick("ahi_ge5", defaultAnalysis.contrasts),
    },
    survivalFeatureIds,
  };
}
