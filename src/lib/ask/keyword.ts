import type { CurveView, FeatureRegistry, SurvivalManifest } from "@/lib/ask/sources";
import { DECORATION, MIN_TERM_LENGTH, mentions, nameForms, normalize, sameLineage } from "@/lib/ask/text";

/**
 * Deterministic keyword router: the fallback when the Jev router (/api/ask) is unavailable or rate-limited.
 * Picks a page by keyword (first match wins), then the longest PheCode name in the prompt.
 */

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

export interface KeywordIndex {
  terms: Term[];
  pools: Record<FeaturePool, Set<string>>;
  /** Curated features with incidence curves, with normalized names. */
  headlines: Term[];
}

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

export function buildKeywordIndex(registry: FeatureRegistry, survival: SurvivalManifest): KeywordIndex {
  const { feature_id, feature_name, prevalence, incidence, alternate_names } = registry.columns;
  const terms: Term[] = [];
  feature_id.forEach((id, i) => {
    const forms = new Set([feature_name[i], ...alternate_names[i]].flatMap(nameForms));
    for (const text of forms) if (text.length >= MIN_TERM_LENGTH) terms.push({ id, text });
  });
  const curves: Record<CurveView, Set<string>> = { severity: new Set(), cpap: new Set() };
  for (const f of survival.features) {
    if (f.available_views.severity) curves.severity.add(String(f.feature_id));
    if (f.available_views.cpap) curves.cpap.add(String(f.feature_id));
  }
  return {
    terms,
    pools: {
      prevalence: new Set(feature_id.filter((_, i) => prevalence[i])),
      incidence: new Set(feature_id.filter((_, i) => incidence[i])),
      ...curves,
    },
    headlines: survival.features.map((f) => ({
      id: String(f.feature_id),
      text: ` ${normalize(f.feature_name.replace(DECORATION, " "))} `,
    })),
  };
}

/**
 * Longest feature name contained in the prompt. A match outside the curated set (features with incidence curves) is
 * promoted to the curated feature in its PheCode lineage whose name contains the same words
 * ("hypertension" → Essential hypertension). Returns null unless the result exists in `pool`.
 */
function matchFeature(index: KeywordIndex, text: string, pool: FeaturePool): string | null {
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

/** `loadIndex` is called only when the chosen page takes a feature. */
export async function keywordHref(prompt: string, loadIndex: () => Promise<KeywordIndex>): Promise<string> {
  const text = ` ${normalize(prompt)} `;
  const route = ROUTES.find((r) => r.words.some((w) => mentions(text, w))) ?? DEFAULT_ROUTE;
  if (route.refine?.words.some((w) => mentions(text, w))) return route.refine.href;
  if (!route.pool) return route.href;
  const feature = matchFeature(await loadIndex(), text, route.pool);
  return feature ? `${route.href}?${new URLSearchParams({ feature })}` : route.href;
}
