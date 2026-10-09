import { Suspense } from "react";
import {
  IncidenceExplorer,
  type IncidenceFeature,
  type IncidenceView,
} from "@/components/incidence/IncidenceExplorer";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabLinks } from "@/components/ui/TabLinks";
import { readPublicJson } from "@/lib/data/server";

interface SurvivalManifest {
  defaults: { feature_id: string; window_days: number };
  strata: {
    severity_group_order: string[];
    cpap_window_order: number[];
    cpap_group_order: string[];
  };
  features: {
    feature_id: string;
    feature_name: string;
    category: string;
    path: string;
    available_views: Record<IncidenceView, boolean>;
  }[];
}

const TABS = [
  { label: "OSA severity", href: "/incidence/severity" },
  { label: "CPAP adherence", href: "/incidence/cpap" },
];

export function IncidencePage(props: { view: IncidenceView }) {
  const { view } = props;
  const manifest = readPublicJson<SurvivalManifest>("survival-manifest.json");
  const features: IncidenceFeature[] = manifest.features
    .map((feature) => ({
      id: String(feature.feature_id),
      name: feature.feature_name,
      category: feature.category,
      path: feature.path.replace(/^data\//, ""),
      views: feature.available_views,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const groupOrder = view === "severity" ? manifest.strata.severity_group_order : manifest.strata.cpap_group_order;

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pb-24 sm:px-6">
      <PageHeader title="Incidence curves">
        <TabLinks ariaLabel="Incidence curves" items={TABS} />
      </PageHeader>
      <Suspense fallback={<div aria-hidden="true" className="h-[640px] md:h-[760px]" />}>
        <IncidenceExplorer
          view={view}
          features={features}
          groupOrder={groupOrder}
          windows={manifest.strata.cpap_window_order.map(String)}
          defaultFeature={String(manifest.defaults.feature_id)}
          defaultWindow={String(manifest.defaults.window_days)}
        />
      </Suspense>
    </main>
  );
}
