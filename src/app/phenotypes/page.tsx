import type { Metadata } from "next";
import { Suspense } from "react";
import { octantLabel } from "@/components/phenotypes/profiles/OctantGlyph";
import { PhenotypeProfiles } from "@/components/phenotypes/profiles/PhenotypeProfiles";
import type { Measure, MeasureCell, MeasureDomain, ProfilesData } from "@/components/phenotypes/profiles/model";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabLinks } from "@/components/ui/TabLinks";
import { readPublicJson } from "@/lib/data/server";
import { OCTANT_COLORS } from "@/lib/palettes";

export const metadata: Metadata = { title: "Phenotypes" };

interface RawCell {
  n_nonmissing: number | null;
  estimate: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
  standardized_difference: number | null;
  suppressed: boolean;
}

interface PhenotypesJson {
  octants: {
    id: string;
    label: string;
    bits: number[];
    n: number;
    pct: number;
    median_ahi: number | null;
    median_codes: number | null;
    summary: string;
  }[];
  cluster_profiles: {
    metrics: {
      id: string;
      label: string;
      domain: string;
      metric_type: "continuous" | "binary";
      unit: string;
      overall: RawCell;
      by_octant: Record<string, RawCell>;
    }[];
  };
  cpap_treatment: {
    windows: { id: string; label: string }[];
    rows: { group_id: string; window_id: string; documented_setup_pct: number | null }[];
  };
}

const DOMAIN_LABELS: Record<string, string> = {
  physiologic: "Physiology",
  symptom: "Symptoms",
  comorbidity: "Comorbidity",
  external: "AHI and severity",
  demographic: "Demographics",
  utilisation: "Utilization",
  "follow-up": "Follow-up",
};

/** Display labels; source labels are lower case and carry units already shown beside values. */
const MEASURE_LABELS: Record<string, string> = {
  odi4pct: "ODI 4%",
  min_spo2: "Minimum SpO₂",
  mean_spo2: "Mean SpO₂",
  t90_fraction: "T90",
  ess_total: "Epworth score",
  isi_total: "Insomnia Severity Index",
  fosq_impair: "FOSQ impairment",
  phq2_total: "PHQ-2",
  stop_total: "STOP score",
  n_phecodes_distinct: "Distinct PheCodes",
  cond_obesity: "Obesity",
  cond_hyperlipidemia: "Hyperlipidemia",
  cond_hypertension: "Hypertension",
  cond_impaired_fasting_glucose: "Impaired fasting glucose",
  cond_anxiety: "Anxiety disorders",
  cond_gerd: "GERD",
  index_ahi: "AHI",
  age_years: "Age",
  bmi: "BMI",
  female: "Female",
  ahi_severity_none: "No OSA (AHI <5)",
  ahi_severity_mild: "Mild (AHI 5–15)",
  ahi_severity_moderate: "Moderate (AHI 15–30)",
  ahi_severity_severe: "Severe (AHI ≥30)",
  followup_years: "Follow-up",
  enc_per_year: "Encounters per year",
};

const UNIT_SUFFIXES: Record<string, string> = {
  "events/h": "/h",
  "%": "%",
  points: "",
  count: "",
  years: " y",
  "kg/m2": " kg/m²",
  "encounters/year": "/y",
};

const CPAP_WINDOW_LABELS: Record<string, string> = {
  index: "By sleep study",
  "observed-follow-up": "All follow-up",
};

function toCell(raw: RawCell): MeasureCell {
  return {
    estimate: raw.estimate,
    median: raw.median,
    q1: raw.q1,
    q3: raw.q3,
    n: raw.n_nonmissing,
    smd: raw.standardized_difference,
    suppressed: raw.suppressed,
  };
}

function buildProfilesData(source: PhenotypesJson): ProfilesData {
  const octants = source.octants.map((o) => ({
    id: o.id,
    label: octantLabel(o.label),
    color: OCTANT_COLORS[o.id] ?? "#939393",
    bits: o.bits,
    n: o.n,
    pct: o.pct,
    medianAhi: o.median_ahi,
    medianCodes: o.median_codes,
    summary: o.summary,
  }));

  const domains = new Map(
    Object.entries(DOMAIN_LABELS).map(([id, label]): [string, MeasureDomain] => [id, { id, label, measures: [] }]),
  );
  for (const metric of source.cluster_profiles.metrics) {
    const label = MEASURE_LABELS[metric.id] ?? metric.label.charAt(0).toUpperCase() + metric.label.slice(1);
    const measure: Measure = {
      id: metric.id,
      label,
      percent: metric.metric_type === "binary" || metric.unit === "fraction",
      unit: UNIT_SUFFIXES[metric.unit] ?? ` ${metric.unit}`,
      overall: toCell(metric.overall),
      byOctant: Object.fromEntries(octants.map((o) => [o.id, toCell(metric.by_octant[o.id])])),
    };
    let domain = domains.get(metric.domain);
    if (!domain) {
      domain = { id: metric.domain, label: metric.domain.charAt(0).toUpperCase() + metric.domain.slice(1), measures: [] };
      domains.set(metric.domain, domain);
    }
    domain.measures.push(measure);
  }

  const setupPct: ProfilesData["cpap"]["setupPct"] = {};
  for (const row of source.cpap_treatment.rows) {
    setupPct[row.group_id] ??= {};
    setupPct[row.group_id][row.window_id] = row.documented_setup_pct;
  }

  return {
    octants,
    domains: [...domains.values()].filter((d) => d.measures.length > 0),
    cpap: {
      windows: source.cpap_treatment.windows.map((w) => ({ id: w.id, label: CPAP_WINDOW_LABELS[w.id] ?? w.label })),
      setupPct,
    },
  };
}

export default function PhenotypesPage() {
  const data = buildProfilesData(readPublicJson<PhenotypesJson>("phenotypes.json"));
  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pb-24 sm:px-6">
      <PageHeader title="Phenotypes">
        <TabLinks
          ariaLabel="Phenotypes"
          items={[
            { label: "Profiles", href: "/phenotypes" },
            { label: "Outcomes", href: "/phenotypes/outcomes" },
          ]}
        />
      </PageHeader>
      <Suspense fallback={<div aria-hidden="true" className="min-h-[1600px]" />}>
        <PhenotypeProfiles data={data} />
      </Suspense>
    </main>
  );
}
