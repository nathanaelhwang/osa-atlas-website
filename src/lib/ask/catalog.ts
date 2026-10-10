import "server-only";

import { octantLabel } from "@/components/phenotypes/profiles/OctantGlyph";
import type { FeatureRegistry, PhenotypesSource, SurvivalManifest, WasFeatureRegistry } from "@/lib/ask/sources";
import { DECORATION, MIN_TERM_LENGTH, mentions, nameForms, normalize, QUALIFIER, sameLineage } from "@/lib/ask/text";
import { getWasPageConfig, readPublicJson } from "@/lib/data/server";
import { categoryOrder, type PaletteKey } from "@/lib/palettes";
import { WAS_FAMILY_SLUGS, type WasPageConfig, type WasSlug } from "@/lib/was-config";

/** Everything the ask router can point at, built once per server instance from public/data. */

export type WasFamily = "labwas" | "medwas" | "qwas" | "procwas" | "utilwas" | "behwas";
/** Pages whose feature (or outcome) param is a PheCode. */
export type CodePage = "phedas-prevalence" | "phedas-incidence" | "curves-severity" | "curves-cpap" | "outcomes";
export type PageId = WasSlug | "curves-severity" | "curves-cpap" | "profiles" | "outcomes";

export type EntityKind = "disease" | "lab" | "medication" | "questionnaire" | "procedure" | "specialty" | "behavior";

/** One row key of an entity on a WAS page (UtilWAS has one per care setting). */
export interface WasVariant {
  key: string;
  subgroup: string | null;
  analyses: string[];
  windows: string[];
}

/** Something a user can name: a disease, lab, medication, questionnaire item, procedure, specialty or behavior. */
export interface Entity {
  /** PheCode for diseases, else the preferred WAS feature_key. */
  id: string;
  name: string;
  kind: EntityKind;
  /** PheCode body system, or the WAS family category. */
  category: string;
  alternates: string[];
  /** Normalized names used for retrieval. */
  forms: string[];
  /** Param value on each PheCode page; includes promotions within a PheCode lineage (401 → 401.1 on curves). */
  codes: Partial<Record<CodePage, string>>;
  /** Row keys per WAS family, preferred first. */
  was: Partial<Record<WasFamily, WasVariant[]>>;
}

export interface OutcomeOption {
  id: string;
  name: string;
  level: "phecode" | "system";
  /** Octant the outcomes page selects when the URL names none. */
  strongestOctant: string | null;
}

export interface Catalog {
  entities: Entity[];
  was: Record<WasSlug, WasPageConfig>;
  /** Native members of each PheCode page, without promotions. */
  pools: Record<CodePage, Set<string>>;
  /** Valid `category` values per WAS page and analysis id. */
  categories: Record<WasSlug, Record<string, string[]>>;
  /** Valid `setting` values per analysis id; analyses without a setting filter are absent. */
  settings: Record<string, string[]>;
  bodySystems: string[];
  familyCategories: Record<Exclude<WasFamily, "utilwas">, string[]>;
  octants: { id: string; label: string; summary: string }[];
  outcomes: OutcomeOption[];
  curves: { defaultFeature: string; windows: string[]; defaultWindow: string };
}

const KIND_BY_FAMILY: Record<Exclude<WasFamily, "utilwas">, EntityKind> = {
  labwas: "lab",
  medwas: "medication",
  qwas: "questionnaire",
  procwas: "procedure",
  behwas: "behavior",
};

const PALETTE_BY_FAMILY: Record<Exclude<WasFamily, "utilwas">, PaletteKey> = {
  labwas: "labwas",
  medwas: "medwas",
  qwas: "qwas",
  procwas: "procwas",
  behwas: "behwas",
};

/** Key used when a UtilWAS feature is named without a care setting: primary diagnoses first, physicians first. */
const SUBGROUP_PREFERENCE = [
  "Physician visit · primary diagnosis",
  "Emergency department · primary diagnosis",
  "Urgent care · primary diagnosis",
  "Inpatient · principal diagnosis",
  "Emergency department · secondary diagnosis",
  "Urgent care · secondary diagnosis",
  "Inpatient · secondary diagnosis",
  "Physician-level care",
  "Allied health",
];

const SPECIALTY_ANALYSIS = "utilwas_specialty_rate";
/** LOINC specimen suffix ("Uric acid in Serum or Plasma" → "Uric acid"); users name the analyte only. */
const SPECIMEN =
  / in (serum or plasma|serum|plasma venous|plasma|platelet poor plasma|capillary blood|blood|red blood cells|urine|cerebral spinal fluid|body fluid)\b.*$/i;

function retrievalForms(names: string[]): string[] {
  return [...new Set(names.flatMap(nameForms))].filter((form) => form.length >= MIN_TERM_LENGTH);
}

function bySubgroupPreference(a: WasVariant, b: WasVariant): number {
  const rank = (v: WasVariant) => {
    const i = SUBGROUP_PREFERENCE.indexOf(v.subgroup ?? "");
    return i === -1 ? SUBGROUP_PREFERENCE.length : i;
  };
  return rank(a) - rank(b) || (a.subgroup ?? "").localeCompare(b.subgroup ?? "");
}

/** Normalized name without decorations or trailing qualifiers, padded for `mentions`. */
function baseName(name: string): string {
  return ` ${normalize(name.replace(DECORATION, " ")).replace(QUALIFIER, "")} `;
}

type LineageIndex = Map<string, { id: string; text: string }[]>;

/** Pool members grouped by the integer part of their PheCode (the only codes `sameLineage` can relate). */
function lineageIndex(pool: Set<string>, names: Map<string, string>): LineageIndex {
  const index: LineageIndex = new Map();
  for (const id of pool) {
    const family = id.split(".")[0];
    if (!index.has(family)) index.set(family, []);
    index.get(family)?.push({ id, text: baseName(names.get(id) ?? "") });
  }
  return index;
}

/**
 * Pool member that stands in for `code` when the pool lacks it: same PheCode lineage, and its name contains the
 * entity's name ("Hypertension" 401 → "Essential hypertension" 401.1). Shortest code wins.
 */
function promote(code: string, name: string, index: LineageIndex): string | undefined {
  const base = baseName(name).trim();
  let best: string | undefined;
  for (const member of index.get(code.split(".")[0]) ?? []) {
    if (sameLineage(member.id, code) && mentions(member.text, base) && (best === undefined || member.id.length < best.length)) {
      best = member.id;
    }
  }
  return best;
}

function buildCatalog(): Catalog {
  const phecodes = readPublicJson<FeatureRegistry>("features.json").columns;
  const wasFeatures = readPublicJson<WasFeatureRegistry>("was-features.json").columns;
  const survival = readPublicJson<SurvivalManifest>("survival-manifest.json");
  const phenotypes = readPublicJson<PhenotypesSource>("phenotypes.json");

  const phecodeOutcomes = phenotypes.survival.levels.find((level) => level.id === "phecode")?.outcomes ?? [];
  const pools: Record<CodePage, Set<string>> = {
    "phedas-prevalence": new Set(phecodes.feature_id.filter((_, i) => phecodes.prevalence[i])),
    "phedas-incidence": new Set(phecodes.feature_id.filter((_, i) => phecodes.incidence[i])),
    "curves-severity": new Set(survival.features.filter((f) => f.available_views.severity).map((f) => String(f.feature_id))),
    "curves-cpap": new Set(survival.features.filter((f) => f.available_views.cpap).map((f) => String(f.feature_id))),
    outcomes: new Set(phecodeOutcomes.map((o) => o.outcome_id)),
  };
  const phecodeNames = new Map(phecodes.feature_id.map((id, i) => [id, phecodes.feature_name[i]]));
  const lineages = Object.entries(pools).map(([page, pool]) => [page as CodePage, pool, lineageIndex(pool, phecodeNames)] as const);

  const diseases = new Map<string, Entity>();
  phecodes.feature_id.forEach((id, i) => {
    const name = phecodes.feature_name[i];
    const alternates = phecodes.alternate_names[i];
    const codes: Entity["codes"] = {};
    for (const [page, pool, lineage] of lineages) {
      const code = pool.has(id) ? id : promote(id, name, lineage);
      if (code !== undefined) codes[page] = code;
    }
    diseases.set(id, {
      id,
      name,
      kind: "disease",
      category: phecodes.category[i],
      alternates,
      forms: retrievalForms([name, ...alternates]),
      codes,
      was: {},
    });
  });

  const wasEntities = new Map<string, Entity>();
  wasFeatures.feature_key.forEach((key, i) => {
    const family = wasFeatures.family[i] as WasFamily;
    const variant: WasVariant = {
      key,
      subgroup: wasFeatures.subgroup[i] || null,
      analyses: wasFeatures.analysis_ids[i],
      windows: wasFeatures.windows[i],
    };
    const disease = wasFeatures.code_system[i] === "PheCode" ? diseases.get(wasFeatures.feature_id[i]) : undefined;
    if (disease) {
      (disease.was[family] ??= []).push(variant);
      return;
    }
    const name = wasFeatures.feature_name[i];
    const specialty = variant.analyses.includes(SPECIALTY_ANALYSIS);
    // Specialty rows repeat per subgroup (physician-level, allied health); every other row is its own entity.
    const groupKey = specialty ? `${family}:specialty:${name}` : key;
    const existing = wasEntities.get(groupKey);
    if (existing) {
      (existing.was[family] ??= []).push(variant);
      return;
    }
    const alternates = wasFeatures.alternate_names[i];
    wasEntities.set(groupKey, {
      id: key,
      name,
      kind: specialty ? "specialty" : KIND_BY_FAMILY[family as Exclude<WasFamily, "utilwas">],
      category: wasFeatures.category[i],
      alternates,
      forms: retrievalForms(
        family === "labwas" ? [name, name.replace(DECORATION, " ").replace(SPECIMEN, ""), ...alternates] : [name, ...alternates],
      ),
      codes: {},
      was: { [family]: [variant] },
    });
  });

  const entities = [...diseases.values(), ...wasEntities.values()];
  for (const entity of entities) {
    for (const variants of Object.values(entity.was)) variants.sort(bySubgroupPreference);
    if (entity.kind === "specialty") entity.id = entity.was.utilwas?.[0]?.key ?? entity.id;
  }

  const was = Object.fromEntries(
    (["phedas-prevalence", "phedas-incidence", ...WAS_FAMILY_SLUGS] as WasSlug[]).map((slug) => [slug, getWasPageConfig(slug)]),
  ) as Record<WasSlug, WasPageConfig>;

  const categories = {} as Record<WasSlug, Record<string, string[]>>;
  const settings: Record<string, string[]> = {};
  for (const slug of ["phedas-prevalence", "phedas-incidence"] as const) {
    const pool = pools[slug];
    const present = new Set(phecodes.category.filter((_, i) => pool.has(phecodes.feature_id[i])));
    categories[slug] = { [was[slug].analyses[0].id]: categoryOrder("phecode", present) };
  }
  for (const family of WAS_FAMILY_SLUGS) {
    categories[family] = {};
    for (const analysis of was[family].analyses) {
      const rows = wasFeatures.feature_key
        .map((_, i) => i)
        .filter((i) => wasFeatures.family[i] === family && wasFeatures.analysis_ids[i].includes(analysis.id));
      categories[family][analysis.id] = [...new Set(rows.map((i) => wasFeatures.category[i]))].sort();
      if (analysis.subgroupLabel !== null) {
        settings[analysis.id] = [...new Set(rows.map((i) => wasFeatures.subgroup[i]).filter((s): s is string => Boolean(s)))].sort();
      }
    }
  }

  const familyCategories = Object.fromEntries(
    (Object.keys(PALETTE_BY_FAMILY) as Exclude<WasFamily, "utilwas">[]).map((family) => [
      family,
      categoryOrder(
        PALETTE_BY_FAMILY[family],
        wasFeatures.category.filter((_, i) => wasFeatures.family[i] === family),
      ),
    ]),
  ) as Catalog["familyCategories"];

  const outcomes: OutcomeOption[] = phenotypes.survival.levels.flatMap((level) =>
    level.outcomes.map((outcome) => {
      let best: { octant: string; p: number } | null = null;
      for (const panel of outcome.panels) {
        if (panel.p !== null && (best === null || panel.p < best.p)) best = { octant: panel.octant, p: panel.p };
      }
      return { id: outcome.outcome_id, name: outcome.outcome_name, level: level.id, strongestOctant: best?.octant ?? null };
    }),
  );

  return {
    entities,
    was,
    pools,
    categories,
    settings,
    bodySystems: categoryOrder("phecode", phecodes.category),
    familyCategories,
    octants: phenotypes.octants.map(({ id, label, summary }) => ({ id, label: octantLabel(label), summary })),
    outcomes,
    curves: {
      defaultFeature: String(survival.defaults.feature_id),
      windows: survival.strata.cpap_window_order.map(String),
      defaultWindow: String(survival.defaults.window_days),
    },
  };
}

let catalog: Catalog | null = null;

export function getAskCatalog(): Catalog {
  catalog ??= buildCatalog();
  return catalog;
}
