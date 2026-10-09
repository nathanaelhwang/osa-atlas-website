import { fetchJson } from "@/lib/data/client";

/**
 * Turns a free-text prompt into a destination href. This is the single seam a future LLM service replaces;
 * for now it is a deterministic keyword router.
 */

interface FeatureRegistry {
  columns: {
    feature_id: string[];
    feature_name: string[];
    prevalence: boolean[];
    incidence: boolean[];
    alternate_names: string[][];
  };
}

interface SurvivalManifest {
  features: { feature_id: string; feature_name: string; available_views: Partial<Record<CurveView, boolean>> }[];
}

type CurveView = "severity" | "cpap";
type FeaturePool = "prevalence" | "incidence" | CurveView;

interface Route {
  href: string;
  /** Destination accepts `?feature=` for features in this pool. */
  pool?: FeaturePool;
  /** Narrower destination when the prompt also mentions one of these words. */
  refine?: { words: string[]; href: string };
}

interface Term {
  id: string;
  text: string;
}

interface FeatureIndex {
  terms: Term[];
  pools: Record<FeaturePool, Set<string>>;
  /** Curated features with incidence curves, with normalized names. */
  headlines: Term[];
}

const MIN_TERM_LENGTH = 4;

/** First match wins. Words and phrases are matched whole, after normalization. */
const ROUTES: (Route & { words: string[] })[] = [
  { words: ["cpap", "pap", "adherence"], href: "/incidence/cpap", pool: "cpap" },
  { words: ["curve", "curves", "cumulative", "by osa severity", "by severity"], href: "/incidence/severity", pool: "severity" },
  {
    words: ["incident", "incidence", "new", "develop", "develops", "developing", "future"],
    href: "/phedas/incidence",
    pool: "incidence",
  },
  {
    words: ["phenotype", "phenotypes", "octant", "octants", "cluster", "clusters"],
    href: "/phenotypes",
    refine: { words: ["outcome", "outcomes", "risk", "risks"], href: "/phenotypes/outcomes" },
  },
  { words: ["lab", "labs"], href: "/was/labwas" },
  { words: ["medication", "medications", "drug", "drugs", "prescription", "prescriptions"], href: "/was/medwas" },
  { words: ["questionnaire", "questionnaires", "sleepiness", "symptom survey"], href: "/was/qwas" },
  { words: ["procedure", "procedures"], href: "/was/procwas" },
  { words: ["visit", "visits", "utilization", "emergency", "specialty", "specialties"], href: "/was/utilwas" },
  {
    words: ["behavior", "behaviors", "behaviour", "no show", "no shows", "vaccine", "vaccines", "vaccination", "vaccinations"],
    href: "/was/behwas",
  },
];

const DEFAULT_ROUTE: Route = { href: "/phedas/prevalence", pool: "prevalence" };

/** Trailing PheCode qualifiers that users never type. */
const QUALIFIER = / (nos|nec|unspecified)$/;
const BRACKETED = /\[([^\]]+)\]/g;
const DECORATION = /\s*(\[[^\]]*\]|\([^)]*\))/g;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Whole-word containment; `text` must be normalized and padded with single spaces. */
function mentions(text: string, phrase: string): boolean {
  return text.includes(` ${phrase} `);
}

/** Matchable forms of a feature name: as written, without decorations or qualifiers, and bracketed synonyms. */
function nameForms(name: string): string[] {
  const forms = [name, name.replace(DECORATION, " "), ...Array.from(name.matchAll(BRACKETED), (m) => m[1])];
  return forms.flatMap((form) => {
    const text = normalize(form);
    return [text, text.replace(QUALIFIER, "")];
  });
}

/** PheCodes in one lineage: one is the other refined by more digits (401 → 401.1, 427.2 → 427.21). */
function sameLineage(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.startsWith(short) && (short.includes(".") || long[short.length] === ".");
}

function buildIndex(registry: FeatureRegistry, survival: SurvivalManifest): FeatureIndex {
  const { feature_id, feature_name, prevalence, incidence, alternate_names } = registry.columns;
  const terms: Term[] = [];
  feature_id.forEach((id, i) => {
    const forms = new Set([feature_name[i], ...alternate_names[i]].flatMap(nameForms));
    for (const text of forms) if (text.length >= MIN_TERM_LENGTH) terms.push({ id, text });
  });
  const curves: Record<CurveView, Set<string>> = { severity: new Set(), cpap: new Set() };
  for (const f of survival.features) {
    if (f.available_views.severity) curves.severity.add(f.feature_id);
    if (f.available_views.cpap) curves.cpap.add(f.feature_id);
  }
  return {
    terms,
    pools: {
      prevalence: new Set(feature_id.filter((_, i) => prevalence[i])),
      incidence: new Set(feature_id.filter((_, i) => incidence[i])),
      ...curves,
    },
    headlines: survival.features.map((f) => ({ id: f.feature_id, text: ` ${normalize(f.feature_name.replace(DECORATION, " "))} ` })),
  };
}

let indexPromise: Promise<FeatureIndex> | null = null;

function loadIndex(): Promise<FeatureIndex> {
  if (!indexPromise) {
    indexPromise = Promise.all([
      fetchJson<FeatureRegistry>("features.json"),
      fetchJson<SurvivalManifest>("survival-manifest.json"),
    ]).then(([registry, survival]) => buildIndex(registry, survival));
    indexPromise.catch(() => {
      indexPromise = null;
    });
  }
  return indexPromise;
}

/**
 * Longest feature name contained in the prompt. A match outside the curated set (features with incidence curves) is
 * promoted to the curated feature in its PheCode lineage whose name contains the same words
 * ("hypertension" → Essential hypertension). Returns null unless the result exists in `pool`.
 */
function matchFeature(index: FeatureIndex, text: string, pool: FeaturePool): string | null {
  let best: Term | null = null;
  for (const term of index.terms) {
    if ((!best || term.text.length > best.text.length) && mentions(text, term.text)) best = term;
  }
  if (!best) return null;
  const match = best;
  const headline =
    index.headlines.find((h) => h.id === match.id) ??
    index.headlines.find((h) => sameLineage(h.id, match.id) && mentions(h.text, match.text));
  const id = headline?.id ?? match.id;
  return index.pools[pool].has(id) ? id : null;
}

export async function resolveAsk(prompt: string): Promise<string> {
  const text = ` ${normalize(prompt)} `;
  const route = ROUTES.find((r) => r.words.some((w) => mentions(text, w))) ?? DEFAULT_ROUTE;
  if (route.refine?.words.some((w) => mentions(text, w))) return route.refine.href;
  if (!route.pool) return route.href;
  const feature = matchFeature(await loadIndex(), text, route.pool);
  return feature ? `${route.href}?${new URLSearchParams({ feature })}` : route.href;
}
