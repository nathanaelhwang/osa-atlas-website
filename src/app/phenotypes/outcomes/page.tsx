import type { Metadata } from "next";
import { Suspense } from "react";
import { OutcomesExplorer } from "@/components/phenotypes/outcomes/OutcomesExplorer";
import type { OutcomeOctant, OutcomeSummary } from "@/components/phenotypes/outcomes/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabLinks } from "@/components/ui/TabLinks";
import { readPublicJson } from "@/lib/data/server";

export const metadata: Metadata = { title: "Phenotype outcomes" };

interface RawPanel {
  octant: string;
  hr_m4: number | null;
  ci_low: number | null;
  ci_high: number | null;
  p: number | null;
  sig_fdr: boolean | null;
  sig_bon: boolean | null;
}

interface PhenotypesJson {
  octants: { id: string; label: string; bits: number[] }[];
  survival: {
    levels: {
      id: "phecode" | "system";
      outcomes: { outcome_id: string; outcome_name: string; category: string; asset_path: string; panels: RawPanel[] }[];
    }[];
  };
}

export default function PhenotypeOutcomesPage() {
  const data = readPublicJson<PhenotypesJson>("phenotypes.json");
  const octants: OutcomeOctant[] = data.octants.map(({ id, label, bits }) => ({ id, label, bits }));
  const outcomes: OutcomeSummary[] = data.survival.levels.flatMap((level) =>
    level.outcomes.map((outcome) => ({
      id: outcome.outcome_id,
      level: level.id,
      name: outcome.outcome_name,
      category: outcome.category,
      path: outcome.asset_path.replace(/^data\//, ""),
      panels: outcome.panels.map((panel) => ({
        octant: panel.octant,
        hr: panel.hr_m4,
        ciLow: panel.ci_low,
        ciHigh: panel.ci_high,
        p: panel.p,
        sigFdr: panel.sig_fdr === true,
        sigBon: panel.sig_bon === true,
      })),
    })),
  );

  return (
    <main className="w-full px-4 pb-24 sm:px-6">
      <PageHeader title="Phenotypes">
        <TabLinks
          ariaLabel="Phenotypes"
          items={[
            { label: "Profiles", href: "/phenotypes" },
            { label: "Outcomes", href: "/phenotypes/outcomes" },
          ]}
        />
      </PageHeader>
      <Suspense fallback={<div aria-hidden="true" className="min-h-[720px]" />}>
        <OutcomesExplorer outcomes={outcomes} octants={octants} />
      </Suspense>
    </main>
  );
}
