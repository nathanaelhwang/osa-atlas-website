import { DEFAULT_OUTCOME } from "@/components/phenotypes/outcomes/types";
import type { Catalog, Entity, PageId, WasFamily } from "@/lib/ask/catalog";
import type { WasSlug } from "@/lib/was-config";
import { resolveWasState, wasQuery } from "@/lib/was-state";

/** A routing decision in site terms; `buildHref` turns it into the URL the destination page itself would write. */
export interface Plan {
  page: PageId;
  entity: Entity | null;
  /** Analysis ids the requested measure maps to; the page's own analysis among them is used. */
  analyses: string[];
  model: string | null;
  contrast: string | null;
  window: string | null;
  cpapWindow: string | null;
  view: string | null;
  setting: string | null;
  octant: string | null;
  /** Category filter (or body-system outcome) used when no entity is named. */
  category: string | null;
}

const PATHS: Record<Exclude<PageId, WasSlug>, string> = {
  "curves-severity": "/incidence/severity",
  "curves-cpap": "/incidence/cpap",
  profiles: "/phenotypes",
  outcomes: "/phenotypes/outcomes",
};

function withQuery(path: string, query: URLSearchParams | string): string {
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

function wasHref(catalog: Catalog, slug: WasSlug, plan: Plan): string {
  const config = catalog.was[slug];
  const phedas = slug === "phedas-prevalence" || slug === "phedas-incidence";
  let analysis = plan.analyses.find((id) => config.analyses.some((a) => a.id === id)) ?? config.defaults.analysis;
  let timeWindow = plan.window;
  let feature: string | null = null;
  let featureWindows: string[] | null = null;
  let setting = plan.setting;

  if (plan.entity && phedas) {
    feature = plan.entity.codes[slug] ?? null;
  } else if (plan.entity) {
    const variants = plan.entity.was[slug as WasFamily] ?? [];
    const variant = variants.find((v) => setting !== null && v.subgroup === setting) ?? variants[0];
    if (variant) {
      if (!variant.analyses.includes(analysis)) {
        analysis = variant.analyses.includes(config.defaults.analysis) ? config.defaults.analysis : variant.analyses[0];
      }
      if (!variant.windows.includes(timeWindow ?? config.defaults.window)) {
        timeWindow = variant.windows.includes(config.defaults.window) ? config.defaults.window : variant.windows[0];
      }
      feature = variant.key;
      featureWindows = variant.windows;
      // The setting filter accompanies a feature only when the feature's row is in that setting.
      if (variant.subgroup !== setting) setting = null;
    }
  }

  const category = plan.entity === null && plan.category !== null && catalog.categories[slug][analysis]?.includes(plan.category)
    ? plan.category
    : null;
  const state = resolveWasState(config, {
    analysis,
    window: timeWindow,
    model: plan.model,
    contrast: plan.contrast,
    category,
    setting: setting !== null && catalog.settings[analysis]?.includes(setting) ? setting : null,
    view: plan.view,
    feature,
  });
  const valid = featureWindows === null || featureWindows.includes(state.window);
  return withQuery(config.href, wasQuery(config, valid ? state : { ...state, feature: null }));
}

export function buildHref(catalog: Catalog, plan: Plan): string {
  const { page } = plan;
  const query = new URLSearchParams();
  switch (page) {
    case "curves-severity":
    case "curves-cpap": {
      const feature = plan.entity?.codes[page];
      if (feature !== undefined && feature !== catalog.curves.defaultFeature) query.set("feature", feature);
      const { windows, defaultWindow } = catalog.curves;
      if (page === "curves-cpap" && plan.cpapWindow !== null && plan.cpapWindow !== defaultWindow && windows.includes(plan.cpapWindow)) {
        query.set("window", plan.cpapWindow);
      }
      return withQuery(PATHS[page], query);
    }
    case "profiles": {
      if (plan.octant !== null && plan.octant !== catalog.octants[0]?.id && catalog.octants.some((o) => o.id === plan.octant)) {
        query.set("octant", plan.octant);
      }
      if (plan.view === "heatmap") query.set("view", "heatmap");
      return withQuery(PATHS[page], query);
    }
    case "outcomes": {
      const systemOutcome = catalog.outcomes.find((o) => o.level === "system" && o.id === plan.category);
      const outcomeId = plan.entity?.codes.outcomes ?? (plan.entity === null ? systemOutcome?.id : undefined) ?? DEFAULT_OUTCOME;
      if (outcomeId !== DEFAULT_OUTCOME) query.set("outcome", outcomeId);
      const outcome = catalog.outcomes.find((o) => o.id === outcomeId);
      if (plan.octant !== null && plan.octant !== outcome?.strongestOctant && catalog.octants.some((o) => o.id === plan.octant)) {
        query.set("octant", plan.octant);
      }
      return withQuery(PATHS[page], query);
    }
    default:
      return wasHref(catalog, page, plan);
  }
}
