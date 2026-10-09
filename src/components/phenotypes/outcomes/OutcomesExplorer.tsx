"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ForestPlot } from "@/components/phenotypes/outcomes/ForestPlot";
import { OutcomeCurves } from "@/components/phenotypes/outcomes/OutcomeCurves";
import type { OutcomeOctant, OutcomeSummary } from "@/components/phenotypes/outcomes/types";
import { octantLabel } from "@/components/phenotypes/profiles/OctantGlyph";
import { ComboBox } from "@/components/ui/ComboBox";
import { categoryColor, categoryLabel, OCTANT_COLORS } from "@/lib/palettes";

const DEFAULT_OUTCOME = "428.2";

/** Octant with the smallest one-vs-rest p for the outcome. */
function strongestOctant(outcome: OutcomeSummary): string | undefined {
  let best: { octant: string; p: number } | undefined;
  for (const panel of outcome.panels) {
    if (panel.p !== null && (best === undefined || panel.p < best.p)) best = { octant: panel.octant, p: panel.p };
  }
  return best?.octant;
}

export function OutcomesExplorer(props: { outcomes: OutcomeSummary[]; octants: OutcomeOctant[] }) {
  const { outcomes, octants: rawOctants } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const octants = rawOctants.map((octant) => ({ ...octant, label: octantLabel(octant.label) }));
  const names = new Map(
    outcomes.map((outcome) => [
      outcome.id,
      outcome.level === "system" ? categoryLabel("phecode", outcome.id) : outcome.name,
    ]),
  );

  const outcome =
    outcomes.find((candidate) => candidate.id === searchParams.get("outcome")) ??
    outcomes.find((candidate) => candidate.id === DEFAULT_OUTCOME) ??
    outcomes[0];
  const octantParam = searchParams.get("octant");
  const octant =
    octants.find((candidate) => candidate.id === octantParam) ??
    octants.find((candidate) => candidate.id === strongestOctant(outcome)) ??
    octants[0];
  const outcomeName = names.get(outcome.id) ?? outcome.name;

  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value === null) params.delete(name);
      else params.set(name, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const options = outcomes.map((candidate) => {
    const name = names.get(candidate.id) ?? candidate.name;
    return {
      value: candidate.id,
      label: candidate.level === "phecode" ? `${name} (${candidate.id})` : name,
      group: candidate.level === "phecode" ? "PheCodes" : "Body systems",
      color: categoryColor("phecode", candidate.category),
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <ComboBox
        label="Outcome"
        value={outcome.id}
        options={options}
        onChange={(value) => update({ outcome: value, octant: null })}
        className="w-full sm:w-[440px]"
      />
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,11fr)_minmax(0,13fr)]">
        <ForestPlot
          octants={octants}
          panels={outcome.panels}
          selected={octant.id}
          onSelect={(value) => update({ octant: value })}
        />
        <OutcomeCurves
          path={outcome.path}
          outcomeName={outcomeName}
          octant={{ id: octant.id, label: octant.label, color: OCTANT_COLORS[octant.id] }}
          panel={outcome.panels.find((panel) => panel.octant === octant.id)}
        />
      </div>
      <p className="text-[12px] text-muted">Each phenotype vs the other seven. M4 hazard ratios.</p>
    </div>
  );
}
