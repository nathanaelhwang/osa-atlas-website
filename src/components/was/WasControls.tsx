"use client";

import { Select, type SelectOption } from "@/components/ui/Select";
import { CONTRAST_LABELS, MODEL_LABELS, WINDOW_LABELS } from "@/lib/data/labels";
import { categoryLabel, type PaletteKey } from "@/lib/palettes";
import type { WasPageConfig } from "@/lib/was-config";
import type { WasPatch, WasState } from "@/components/was/useWasState";

/** Display text for a subgroup (setting) value; the data joins its parts with a middle dot. */
export function settingLabel(subgroup: string): string {
  return subgroup.replaceAll(" · ", ", ");
}

export function WasControls(props: {
  config: WasPageConfig;
  state: WasState;
  update: (patch: WasPatch) => void;
  /** Categories present in the shown partition, in palette order. */
  categories: string[];
  palette: PaletteKey;
  category: string | null;
  /** Subgroup filter label, or null when the shown analysis has none. */
  subgroupLabel: string | null;
  settings: string[];
  setting: string | null;
}) {
  const { config, state, update, categories, palette, category, subgroupLabel, settings, setting } = props;
  const { analysis } = state;
  const all: SelectOption = { value: "", label: "All" };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {config.analyses.length > 1 && (
        <Select
          label="Measure"
          value={analysis.id}
          options={config.analyses.map((a) => ({ value: a.id, label: a.label }))}
          onChange={(v) => update({ analysis: v })}
        />
      )}
      <Select
        label="Exposure"
        value={state.contrast}
        options={state.contrasts.map((c) => ({ value: c, label: CONTRAST_LABELS[c] ?? c }))}
        onChange={(v) => update({ contrast: v })}
      />
      <Select
        label="Adjustment"
        value={state.model}
        options={state.models.map((m) => ({ value: m, label: MODEL_LABELS[m] ?? m }))}
        onChange={(v) => update({ model: v })}
      />
      {analysis.windows.length > 1 && (
        <Select
          label="Window"
          value={state.window}
          options={analysis.windows.map((w) => ({ value: w, label: WINDOW_LABELS[w] ?? w }))}
          onChange={(v) => update({ window: v })}
        />
      )}
      {categories.length > 1 && (
        <Select
          label={config.categoryLabel}
          value={category ?? ""}
          options={[all, ...categories.map((c) => ({ value: c, label: categoryLabel(palette, c) }))]}
          onChange={(v) => update({ category: v || null })}
        />
      )}
      {subgroupLabel && settings.length > 1 && (
        <Select
          label={subgroupLabel}
          value={setting ?? ""}
          options={[all, ...settings.map((s) => ({ value: s, label: settingLabel(s) }))]}
          onChange={(v) => update({ setting: v || null })}
        />
      )}
    </div>
  );
}
