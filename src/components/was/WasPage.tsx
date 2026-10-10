"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ManhattanPlot, type AssocPlotProps } from "@/components/charts/ManhattanPlot";
import { VolcanoPlot } from "@/components/charts/VolcanoPlot";
import { Legend } from "@/components/ui/Legend";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SidePanel } from "@/components/ui/SidePanel";
import { TabLinks } from "@/components/ui/TabLinks";
import { FeatureDetail, type FeatureDetailProps } from "@/components/was/FeatureDetail";
import { settingLabel, WasControls } from "@/components/was/WasControls";
import { PLOT_BOX } from "@/components/was/WasFallback";
import { useWasState } from "@/components/was/useWasState";
import { loadPartition } from "@/lib/data/client";
import { formatInt } from "@/lib/data/format";
import type { AssocRow, Partition } from "@/lib/data/types";
import { categoryColor, categoryLabel, categoryOrder } from "@/lib/palettes";
import type { WasPageConfig } from "@/lib/was-config";

const EMPTY_ROWS: AssocRow[] = [];

const PHEDAS_TABS = [
  { label: "Prevalence", href: "/phedas/prevalence" },
  { label: "Incidence", href: "/phedas/incidence" },
];

/** Loads `path`, keeping the previously loaded partition visible until the next one arrives. */
function usePartition(path: string) {
  const [loaded, setLoaded] = useState<Partition | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadPartition(path).then(
      (partition) => {
        if (!active) return;
        setLoaded(partition);
        setFailedPath(null);
      },
      () => {
        if (active) setFailedPath(path);
      },
    );
    return () => {
      active = false;
    };
  }, [path, attempt]);

  const retry = useCallback(() => {
    setFailedPath(null);
    setAttempt((n) => n + 1);
  }, []);

  return { partition: loaded, pending: loaded?.path !== path, failed: failedPath === path, retry };
}

export function WasPage({ config }: { config: WasPageConfig }) {
  const [state, update] = useWasState(config);
  const { partition, pending, failed, retry } = usePartition(state.partitionPath);

  // The shown partition may still belong to the previous selection while the next one loads.
  const shownAnalysis = useMemo(
    () =>
      (partition && config.analyses.find((a) => Object.values(a.partitions).includes(partition.path))) ||
      state.analysis,
    [config, partition, state.analysis],
  );
  const { palette, colorBy, subgroupLabel } = shownAnalysis;
  const rows = partition?.rows ?? EMPTY_ROWS;

  const categories = useMemo(() => categoryOrder(palette, new Set(rows.map((r) => r.category))), [palette, rows]);
  const settings = useMemo(
    () =>
      subgroupLabel
        ? [...new Set(rows.map((r) => r.subgroup).filter((s): s is string => Boolean(s)))].sort()
        : [],
    [subgroupLabel, rows],
  );
  const category = state.category !== null && categories.includes(state.category) ? state.category : null;
  const setting = state.setting !== null && settings.includes(state.setting) ? state.setting : null;

  const filtered = useMemo(
    () =>
      category === null && setting === null
        ? rows
        : rows.filter((r) => (category === null || r.category === category) && (setting === null || r.subgroup === setting)),
    [rows, category, setting],
  );
  const plotted = useMemo(() => filtered.filter((r) => r.nlp !== null || r.pZero), [filtered]);
  const counts = useMemo(
    () => ({
      features: plotted.length,
      fdr: plotted.filter((r) => r.sigFdr).length,
      bonferroni: plotted.filter((r) => r.sigBon).length,
    }),
    [plotted],
  );

  const groupOf = useCallback(
    (row: AssocRow) => (colorBy === "subgroup" ? (row.subgroup ?? "") : row.category),
    [colorBy],
  );
  const colorOf = useCallback((row: AssocRow) => categoryColor(palette, groupOf(row)), [palette, groupOf]);
  const groupLabel = useCallback((group: string) => categoryLabel(palette, group), [palette]);
  const groupOrder = useMemo(() => categoryOrder(palette, new Set(plotted.map(groupOf))), [palette, plotted, groupOf]);
  const legend = useMemo(
    () => groupOrder.map((g) => ({ label: categoryLabel(palette, g), color: categoryColor(palette, g) })),
    [palette, groupOrder],
  );

  const selected = useMemo(
    () => (state.feature === null ? null : (rows.find((r) => r.key === state.feature) ?? null)),
    [rows, state.feature],
  );

  // A feature absent from the loaded partition closes the panel.
  const missingFeature = state.feature !== null && partition !== null && !pending && selected === null;
  useEffect(() => {
    if (missingFeature) update({ feature: null });
  }, [missingFeature, update]);

  const survivalIds = useMemo(() => new Set(config.survivalFeatureIds), [config.survivalFeatureIds]);
  const detail = useMemo<FeatureDetailProps | null>(() => {
    if (selected === null || partition === null) return null;
    return {
      row: selected,
      effectType: partition.effectType,
      directional: partition.directional,
      group: { label: groupLabel(groupOf(selected)), color: colorOf(selected) },
      subgroup: selected.subgroup && colorBy !== "subgroup" ? settingLabel(selected.subgroup) : null,
      incidenceHref:
        palette === "phecode" && survivalIds.has(selected.id)
          ? `/incidence/severity?feature=${encodeURIComponent(selected.id)}`
          : null,
    };
  }, [selected, partition, groupLabel, groupOf, colorOf, colorBy, palette, survivalIds]);

  // Keep the last detail rendered while the panel animates closed.
  const [shownDetail, setShownDetail] = useState(detail);
  if (detail !== null && detail !== shownDetail) setShownDetail(detail);

  const onSelect = useCallback((key: string) => update({ feature: key }), [update]);
  const closePanel = useCallback(() => update({ feature: null }), [update]);

  const directional = partition?.directional ?? true;
  const view = state.view === "volcano" && directional ? "volcano" : "manhattan";
  const plotProps: AssocPlotProps | null = partition && {
    rows: filtered,
    partition,
    colorOf,
    groupOf,
    groupOrder,
    groupLabel,
    selectedKey: selected?.key ?? null,
    onSelect,
  };

  return (
    <main className="w-full px-4 pb-24 sm:px-6">
      <PageHeader title={config.title}>
        {config.slug.startsWith("phedas") && <TabLinks ariaLabel="PheDAS analysis" items={PHEDAS_TABS} />}
      </PageHeader>

      <WasControls
        config={config}
        state={state}
        update={update}
        categories={categories}
        palette={palette}
        category={category}
        subgroupLabel={subgroupLabel}
        settings={settings}
        setting={setting}
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <SegmentedControl
          ariaLabel="Plot type"
          value={view}
          options={[
            { value: "manhattan", label: "Manhattan" },
            { value: "volcano", label: "Volcano", disabled: !directional },
          ]}
          onChange={(v) => update({ view: v })}
        />
        {partition && !failed && (
          <p className="flex flex-wrap gap-x-4 text-[13px] text-muted tabular-nums">
            <span>
              {formatInt(counts.features)} {counts.features === 1 ? "feature" : "features"}
            </span>
            <span>{formatInt(counts.fdr)} FDR</span>
            <span>{formatInt(counts.bonferroni)} Bonferroni</span>
          </p>
        )}
      </div>

      <div className="mt-4 flex">
        <div className="min-w-0 flex-1">
          {failed ? (
            <div className={`${PLOT_BOX} flex items-center gap-3 text-[15px]`}>
              <span className="text-muted">Couldn’t load this analysis.</span>
              <button type="button" onClick={retry} className="font-medium underline-offset-4 hover:underline">
                Retry
              </button>
            </div>
          ) : plotProps === null ? (
            <div className={PLOT_BOX} />
          ) : (
            <div
              aria-busy={pending}
              className={`transition-opacity duration-150 ${pending ? "opacity-40" : "opacity-100"}`}
            >
              {plotted.length === 0 ? (
                <div className={`${PLOT_BOX} flex items-center text-[15px] text-muted`}>
                  No results for this selection.
                </div>
              ) : (
                <>
                  {view === "volcano" ? <VolcanoPlot {...plotProps} /> : <ManhattanPlot {...plotProps} />}
                  <Legend className="mt-4" items={legend} />
                </>
              )}
            </div>
          )}
        </div>
        <SidePanel open={selected !== null} onClose={closePanel} ariaLabel="Selected feature">
          {shownDetail && <FeatureDetail {...shownDetail} />}
        </SidePanel>
      </div>
    </main>
  );
}
