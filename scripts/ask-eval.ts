/**
 * Scores ask routers against labeled prompts.
 *
 *   npm run eval:ask -- [--labels file.jsonl] [--designs keyword,tree,hybrid] [--limit N] [--concurrency N] [--misses]
 *
 * Labels: scripts/ask-eval.jsonl (tuning set, the default) or scripts/ask-eval-holdout.jsonl (held out: never tune
 * against it). `href: null` labels a prompt the router should refuse as unrelated. keyword: the client fallback (never
 * refuses). tree: Jev without candidate retrieval (every named feature walks the tree). hybrid: the shipped router. Jev
 * designs read OPENROUTER_API_KEY from the environment or .env.local.
 */
import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_OUTCOME } from "@/components/phenotypes/outcomes/types";
import { getAskCatalog, type Catalog, type WasFamily } from "@/lib/ask/catalog";
import { decide } from "@/lib/ask/jev";
import { buildKeywordIndex, keywordHref } from "@/lib/ask/keyword";
import { createRetriever, type Retrieve } from "@/lib/ask/retrieve";
import { routePrompt } from "@/lib/ask/router";
import type { FeatureRegistry, SurvivalManifest } from "@/lib/ask/sources";
import { readPublicJson } from "@/lib/data/server";
import type { WasSlug } from "@/lib/was-config";
import { resolveWasState, wasQuery } from "@/lib/was-state";

interface Label {
  prompt: string;
  /** Null: the router should refuse the prompt. */
  href: string | string[] | null;
  tags: string[];
}

interface Outcome {
  label: Label;
  expected: string[];
  actual: string;
  ms: number;
  rounds: number;
  cost: number;
}

type Design = "keyword" | "tree" | "hybrid";

/** The outcome string of a refused prompt. */
const REFUSED = "refused";

const WAS_PARAMS = ["analysis", "window", "model", "contrast", "category", "setting", "view", "feature"];

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Canonical form of an href (defaults dropped, fixed param order) plus every invalid value found in it. */
function canonicalize(catalog: Catalog, keys: Map<string, { family: string; analyses: string[]; windows: string[] }>, href: string) {
  const url = new URL(href, "https://atlas.invalid");
  const params = url.searchParams;
  const errors: string[] = [];
  const allow = (names: string[]) => {
    for (const name of params.keys()) if (!names.includes(name)) errors.push(`unknown param ${name}`);
  };
  const query = new URLSearchParams();

  const slug = (Object.keys(catalog.was) as WasSlug[]).find((s) => catalog.was[s].href === url.pathname);
  if (slug) {
    allow(WAS_PARAMS);
    const config = catalog.was[slug];
    const state = resolveWasState(config, {
      analysis: params.get("analysis"),
      window: params.get("window"),
      model: params.get("model"),
      contrast: params.get("contrast"),
      category: params.get("category"),
      setting: params.get("setting"),
      view: params.get("view"),
      feature: params.get("feature"),
    });
    for (const [name, resolved] of [
      ["analysis", state.analysis.id],
      ["window", state.window],
      ["model", state.model],
      ["contrast", state.contrast],
    ] as const) {
      const raw = params.get(name);
      if (raw !== null && raw.toUpperCase() !== resolved.toUpperCase()) errors.push(`${name}=${raw} unavailable (resolves to ${resolved})`);
    }
    if (state.category !== null && !catalog.categories[slug][state.analysis.id]?.includes(state.category)) {
      errors.push(`category=${state.category} invalid`);
    }
    if (state.setting !== null && !catalog.settings[state.analysis.id]?.includes(state.setting)) {
      errors.push(`setting=${state.setting} invalid`);
    }
    if (state.feature !== null) {
      const key = keys.get(state.feature);
      const phedas = slug === "phedas-prevalence" || slug === "phedas-incidence";
      const valid = phedas
        ? catalog.pools[slug].has(state.feature)
        : key !== undefined &&
          key.family === slug &&
          key.analyses.includes(state.analysis.id) &&
          key.windows.includes(state.window);
      if (!valid) errors.push(`feature=${state.feature} invalid for ${state.analysis.id} ${state.window}`);
    }
    return { href: `${url.pathname}?${wasQuery(config, state)}`.replace(/\?$/, ""), errors };
  }

  switch (url.pathname) {
    case "/incidence/severity":
    case "/incidence/cpap": {
      const cpap = url.pathname === "/incidence/cpap";
      allow(cpap ? ["feature", "window"] : ["feature"]);
      const feature = params.get("feature");
      if (feature !== null && !catalog.pools[cpap ? "curves-cpap" : "curves-severity"].has(feature)) errors.push(`feature=${feature} has no curve`);
      if (feature !== null && feature !== catalog.curves.defaultFeature) query.set("feature", feature);
      const window = params.get("window");
      if (window !== null && !catalog.curves.windows.includes(window)) errors.push(`window=${window} invalid`);
      if (window !== null && window !== catalog.curves.defaultWindow) query.set("window", window);
      break;
    }
    case "/phenotypes": {
      allow(["octant", "view"]);
      const octant = params.get("octant");
      if (octant !== null && !catalog.octants.some((o) => o.id === octant)) errors.push(`octant=${octant} invalid`);
      if (octant !== null && octant !== catalog.octants[0]?.id) query.set("octant", octant);
      const view = params.get("view");
      if (view !== null && view !== "heatmap" && view !== "profile") errors.push(`view=${view} invalid`);
      if (view === "heatmap") query.set("view", view);
      break;
    }
    case "/phenotypes/outcomes": {
      allow(["outcome", "octant"]);
      const outcomeId = params.get("outcome") ?? DEFAULT_OUTCOME;
      const outcome = catalog.outcomes.find((o) => o.id === outcomeId);
      if (!outcome) errors.push(`outcome=${outcomeId} invalid`);
      if (outcomeId !== DEFAULT_OUTCOME) query.set("outcome", outcomeId);
      const octant = params.get("octant");
      if (octant !== null && !catalog.octants.some((o) => o.id === octant)) errors.push(`octant=${octant} invalid`);
      if (octant !== null && octant !== outcome?.strongestOctant) query.set("octant", octant);
      break;
    }
    default:
      errors.push(`unknown path ${url.pathname}`);
  }
  const text = query.toString();
  return { href: text ? `${url.pathname}?${text}` : url.pathname, errors };
}

/** The feature-identifying param of a canonical href, if any. */
function featureOf(href: string): string | null {
  const params = new URL(href, "https://atlas.invalid").searchParams;
  return params.get("feature") ?? params.get("outcome");
}

function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const designs = (argValue("designs") ?? "keyword,tree,hybrid").split(",") as Design[];
  const limit = Number(argValue("limit") ?? Infinity);
  const concurrency = Number(argValue("concurrency") ?? 4);

  const catalog = getAskCatalog();
  const keys = new Map<string, { family: string; analyses: string[]; windows: string[] }>();
  for (const entity of catalog.entities) {
    for (const [family, variants] of Object.entries(entity.was) as [WasFamily, { key: string; analyses: string[]; windows: string[] }[]][]) {
      for (const v of variants) keys.set(v.key, { family, analyses: v.analyses, windows: v.windows });
    }
  }

  const labels: Label[] = readFileSync(argValue("labels") ?? "scripts/ask-eval.jsonl", "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Label)
    .slice(0, limit);

  let invalid = 0;
  for (const label of labels) {
    for (const href of [label.href ?? []].flat()) {
      const { errors } = canonicalize(catalog, keys, href);
      if (errors.length > 0) {
        invalid++;
        console.error(`invalid label "${label.prompt}" → ${href}: ${errors.join("; ")}`);
      }
    }
  }
  if (invalid > 0) process.exit(1);
  console.log(`${labels.length} labels valid\n`);

  const keywordIndex = buildKeywordIndex(
    readPublicJson<FeatureRegistry>("features.json"),
    readPublicJson<SurvivalManifest>("survival-manifest.json"),
  );
  const retrievers: Record<"tree" | "hybrid", Retrieve> = { tree: () => [], hybrid: createRetriever(catalog.entities) };

  const summary: string[][] = [
    ["design", "exact", "page", "feature", "false refusals", "missed refusals", "errors", "p50 ms", "p95 ms", "rounds", "$ / 1k asks"],
  ];
  const byTag = new Map<string, Record<string, [number, number]>>();

  for (const design of designs) {
    const outcomes = await mapLimit(labels, design === "keyword" ? 16 : concurrency, async (label): Promise<Outcome> => {
      const expected = label.href === null ? [REFUSED] : [label.href].flat().map((href) => canonicalize(catalog, keys, href).href);
      const started = performance.now();
      try {
        if (design === "keyword") {
          const href = await keywordHref(label.prompt, async () => keywordIndex);
          return { label, expected, actual: canonicalize(catalog, keys, href).href, ms: performance.now() - started, rounds: 0, cost: 0 };
        }
        const result = await routePrompt(label.prompt, { catalog, decide, retrieve: retrievers[design] });
        return {
          label,
          expected,
          actual: result.href === null ? REFUSED : canonicalize(catalog, keys, result.href).href,
          ms: performance.now() - started,
          rounds: result.rounds,
          cost: result.cost,
        };
      } catch (error) {
        return { label, expected, actual: `error: ${String(error)}`, ms: performance.now() - started, rounds: 0, cost: 0 };
      }
    });

    const n = outcomes.length;
    const exact = outcomes.filter((o) => o.expected.includes(o.actual));
    const page = outcomes.filter((o) => o.expected.some((e) => e.split("?")[0] === o.actual.split("?")[0]));
    const withFeature = outcomes.filter((o) => o.expected.some((e) => featureOf(e) !== null));
    const featureHits = withFeature.filter((o) => o.expected.some((e) => featureOf(e) === featureOf(o.actual)));
    const errors = outcomes.filter((o) => o.actual.startsWith("error:"));
    const offTopic = outcomes.filter((o) => o.label.href === null);
    const falseRefusals = outcomes.filter((o) => o.label.href !== null && o.actual === REFUSED);
    const missedRefusals = offTopic.filter((o) => o.actual !== REFUSED);
    const pct = (k: number, d: number) => `${((100 * k) / Math.max(d, 1)).toFixed(1)}%`;
    summary.push([
      design,
      pct(exact.length, n),
      pct(page.length, n),
      pct(featureHits.length, withFeature.length),
      `${falseRefusals.length}/${n - offTopic.length}`,
      `${missedRefusals.length}/${offTopic.length}`,
      String(errors.length),
      percentile(outcomes.map((o) => o.ms), 0.5).toFixed(0),
      percentile(outcomes.map((o) => o.ms), 0.95).toFixed(0),
      (outcomes.reduce((s, o) => s + o.rounds, 0) / n).toFixed(2),
      ((1000 * outcomes.reduce((s, o) => s + o.cost, 0)) / n).toFixed(4),
    ]);

    for (const o of outcomes) {
      const tag = o.label.tags[0];
      const row = byTag.get(tag) ?? {};
      const [hits, total] = row[design] ?? [0, 0];
      row[design] = [hits + (o.expected.includes(o.actual) ? 1 : 0), total + 1];
      byTag.set(tag, row);
    }

    if (process.argv.includes("--misses")) {
      console.log(`misses: ${design}`);
      for (const o of outcomes) {
        if (!o.expected.includes(o.actual)) console.log(`  ${o.label.prompt}\n    want ${o.expected.join(" | ")}\n    got  ${o.actual}`);
      }
      console.log("");
    }
  }

  const print = (rows: string[][]) => {
    const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
    for (const row of rows) console.log(row.map((cell, c) => cell.padEnd(widths[c])).join("  "));
    console.log("");
  };
  print(summary);
  print([
    ["exact by destination", ...designs],
    ...[...byTag.entries()].map(([tag, row]) => [
      `${tag}`,
      ...designs.map((d) => {
        const [hits, total] = row[d] ?? [0, 0];
        return `${hits}/${total}`;
      }),
    ]),
  ]);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
