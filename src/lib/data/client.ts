import type { AssocRow, EffectType, Partition } from "@/lib/data/types";

type Num = number | null;

/** Parallel-array columns shared by PheDAS and WAS partitions; optional ones exist in only one family. */
interface RawColumns {
  feature_id: (string | number)[];
  feature_key?: string[];
  feature_name: string[];
  category: string[];
  subgroup?: (string | null)[];
  effect: Num[];
  se?: Num[];
  ci_low: Num[];
  ci_high: Num[];
  p: Num[];
  neglog10p: Num[];
  sig_fdr: (boolean | null)[];
  sig_bon: (boolean | null)[];
  unstable: (boolean | null)[];
  n?: Num[];
  n_atrisk?: Num[];
  n_events?: Num[];
}

interface RawPartition {
  metadata: {
    contrast: string;
    effect_type: EffectType;
    effect_scale?: string;
    neutral_value?: number;
    directional?: boolean;
  };
  columns: RawColumns;
}

const EFFECT_DEFAULTS: Record<EffectType, { scale: string; neutral: number; directional: boolean; logScale: boolean }> = {
  OR: { scale: "odds ratio", neutral: 1, directional: true, logScale: true },
  HR: { scale: "hazard ratio", neutral: 1, directional: true, logScale: true },
  IRR: { scale: "rate ratio", neutral: 1, directional: true, logScale: true },
  beta: { scale: "standardized beta", neutral: 0, directional: true, logScale: false },
  wald_F: { scale: "Wald F statistic", neutral: 0, directional: false, logScale: false },
  wald_chi2: { scale: "Wald chi-square statistic", neutral: 0, directional: false, logScale: false },
};

const partitionCache = new Map<string, Promise<Partition>>();
const jsonCache = new Map<string, Promise<unknown>>();

/** Caches the in-flight promise per path; a rejected promise is evicted so the next call retries. */
function memoize<T>(cache: Map<string, Promise<T>>, path: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(path);
  if (hit) return hit;
  const promise = load();
  cache.set(path, promise);
  promise.catch(() => {
    if (cache.get(path) === promise) cache.delete(path);
  });
  return promise;
}

async function fetchData(path: string): Promise<unknown> {
  const url = `/data/${path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  return response.json();
}

function toPartition(path: string, raw: RawPartition): Partition {
  const { metadata, columns: c } = raw;
  const effectType = metadata.effect_type;
  const defaults = EFFECT_DEFAULTS[effectType];
  const rows: AssocRow[] = new Array(c.feature_id.length);
  let bonferroniNlp: number | null = null;

  for (let i = 0; i < rows.length; i++) {
    const id = String(c.feature_id[i]);
    const p = c.p[i] ?? null;
    const sourceNlp = c.neglog10p[i];
    let nlp: number | null = null;
    if (sourceNlp != null && Number.isFinite(sourceNlp)) nlp = sourceNlp;
    else if (p !== null && p > 0 && Number.isFinite(p)) nlp = -Math.log10(p);
    const sigBon = c.sig_bon[i] === true;
    if (sigBon && nlp !== null && (bonferroniNlp === null || nlp < bonferroniNlp)) bonferroniNlp = nlp;

    rows[i] = {
      key: c.feature_key?.[i] ?? id,
      id,
      name: c.feature_name[i],
      category: c.category[i],
      subgroup: c.subgroup?.[i] ?? null,
      effect: c.effect[i] ?? null,
      ciLow: c.ci_low[i] ?? null,
      ciHigh: c.ci_high[i] ?? null,
      se: c.se?.[i] ?? null,
      p,
      nlp,
      pZero: p === 0,
      sigFdr: c.sig_fdr[i] === true,
      sigBon,
      unstable: c.unstable[i] === true,
      n: c.n?.[i] ?? c.n_atrisk?.[i] ?? null,
      nEvents: c.n_events?.[i] ?? null,
    };
  }

  return {
    path,
    effectType,
    effectScale: metadata.effect_scale ?? defaults.scale,
    neutral: metadata.neutral_value ?? defaults.neutral,
    // Omnibus is a joint severity test: never signed, even when PheDAS incidence labels it "HR".
    directional: metadata.contrast !== "omnibus" && (metadata.directional ?? defaults.directional),
    logScale: defaults.logScale,
    rows,
    bonferroniNlp,
  };
}

export function loadPartition(path: string): Promise<Partition> {
  return memoize(partitionCache, path, async () => toPartition(path, (await fetchData(path)) as RawPartition));
}

export function fetchJson<T>(path: string): Promise<T> {
  return memoize(jsonCache, path, () => fetchData(path)) as Promise<T>;
}
