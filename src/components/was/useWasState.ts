"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { WasAnalysisConfig, WasPageConfig } from "@/lib/was-config";

export type WasView = "manhattan" | "volcano";

/** Raw URL query values; null = absent. */
interface WasParams {
  analysis: string | null;
  window: string | null;
  model: string | null;
  contrast: string | null;
  category: string | null;
  setting: string | null;
  view: string | null;
  feature: string | null;
}

export type WasPatch = Partial<WasParams>;

/** URL state resolved against the page config; analysis/window/model/contrast always name an existing partition. */
export interface WasState {
  analysis: WasAnalysisConfig;
  window: string;
  model: string;
  contrast: string;
  /** Models with a partition in the resolved window. */
  models: string[];
  /** Contrasts with a partition in the resolved window and model. */
  contrasts: string[];
  partitionPath: string;
  category: string | null;
  setting: string | null;
  view: WasView;
  feature: string | null;
}

/** First candidate present in `valid`, else the first valid option. */
function firstValid(candidates: (string | null)[], valid: string[]): string {
  return candidates.find((c): c is string => c !== null && valid.includes(c)) ?? valid[0] ?? "";
}

function resolve(config: WasPageConfig, params: WasParams): WasState {
  const { analyses, defaults } = config;
  const analysis =
    analyses.find((a) => a.id === params.analysis) ?? analyses.find((a) => a.id === defaults.analysis) ?? analyses[0];

  const timeWindow = firstValid([params.window, defaults.window], analysis.windows.length > 0 ? analysis.windows : [""]);
  const models = analysis.models.filter((m) =>
    analysis.contrasts.some((c) => `${timeWindow}|${m}|${c}` in analysis.partitions),
  );
  const model = firstValid([params.model?.toUpperCase() ?? null, defaults.model], models);
  const contrasts = analysis.contrasts.filter((c) => `${timeWindow}|${model}|${c}` in analysis.partitions);
  const contrast = firstValid([params.contrast, defaults.contrast], contrasts);

  return {
    analysis,
    window: timeWindow,
    model,
    contrast,
    models,
    contrasts,
    partitionPath: analysis.partitions[`${timeWindow}|${model}|${contrast}`],
    category: params.category || null,
    setting: params.setting || null,
    view: params.view === "volcano" ? "volcano" : "manhattan",
    feature: params.feature || null,
  };
}

/** Query string for a resolved state, omitting values equal to their defaults. */
function toQuery(config: WasPageConfig, state: WasState): string {
  const { defaults } = config;
  const query = new URLSearchParams();
  const entries: [keyof WasParams, string | null, string | null][] = [
    ["analysis", state.analysis.id, defaults.analysis],
    ["window", state.window, defaults.window],
    ["model", state.model, defaults.model],
    ["contrast", state.contrast, defaults.contrast],
    ["category", state.category, null],
    ["setting", state.setting, null],
    ["view", state.view, "manhattan"],
    ["feature", state.feature, null],
  ];
  for (const [key, value, fallback] of entries) {
    if (value !== null && value !== "" && value !== fallback) query.set(key, value);
  }
  return query.toString();
}

/** WAS page state held in the URL query; `update` merges a patch, re-resolves, and replaces the URL. */
export function useWasState(config: WasPageConfig): [WasState, (patch: WasPatch) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params = useMemo<WasParams>(
    () => ({
      analysis: searchParams.get("analysis"),
      window: searchParams.get("window"),
      model: searchParams.get("model"),
      contrast: searchParams.get("contrast"),
      category: searchParams.get("category"),
      setting: searchParams.get("setting"),
      view: searchParams.get("view"),
      feature: searchParams.get("feature"),
    }),
    [searchParams],
  );
  const state = useMemo(() => resolve(config, params), [config, params]);

  const update = useCallback(
    (patch: WasPatch) => {
      const query = toQuery(config, resolve(config, { ...params, ...patch }));
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [config, params, router, pathname],
  );

  return [state, update];
}
