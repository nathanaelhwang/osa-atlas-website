"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { CifChart, type CifSeries } from "@/components/charts/CifChart";
import { ComboBox } from "@/components/ui/ComboBox";
import { Legend } from "@/components/ui/Legend";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { fetchJson } from "@/lib/data/client";
import { formatEffect } from "@/lib/data/format";
import { CPAP_COLORS, SEVERITY_COLORS, categoryColor, categoryLabel } from "@/lib/palettes";

export type IncidenceView = "severity" | "cpap";

export interface IncidenceFeature {
  id: string;
  name: string;
  category: string;
  /** Payload path relative to /data/. */
  path: string;
  views: Record<IncidenceView, boolean>;
}

interface CurveColumns {
  group: string[];
  time_years: number[];
  cif_pct: number[];
}

interface SurvivalPayload {
  metadata: { severe_hr: number | null };
  severity?: { columns: CurveColumns };
  cpap?: {
    omitted_strata: { window_days: number; group: string }[];
    columns: CurveColumns & { window_days: number[] };
  };
}

interface Curves {
  series: CifSeries[];
  xMax: number;
  omitted: boolean;
}

const VIEW_COPY: Record<IncidenceView, { by: string; xLabel: string; footnote: string }> = {
  severity: {
    by: "OSA severity",
    xLabel: "Years since sleep study",
    footnote: "Aalen–Johansen, death as competing event.",
  },
  cpap: {
    by: "CPAP adherence",
    xLabel: "Years after landmark",
    footnote: "OSA patients from the landmark. Crude curves.",
  },
};

const GROUP_COLORS: Record<IncidenceView, Record<string, string>> = { severity: SEVERITY_COLORS, cpap: CPAP_COLORS };

const CPAP_LABELS: Record<string, string> = {
  "4+ hr/night": "4+ hr/night",
  "2-4 hr/night": "2–4 hr/night",
  "0-2 hr/night": "0–2 hr/night",
  "never-started": "Never started",
  unknown: "Unknown",
};

const CPAP_DASHED_GROUP = "unknown";
const WIDE_QUERY = "(min-width: 768px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function buildCurves(payload: SurvivalPayload, view: IncidenceView, landmark: number, groupOrder: string[]): Curves | null {
  const source = view === "severity" ? payload.severity : payload.cpap;
  if (!source) return null;
  const { group, time_years, cif_pct } = source.columns;
  const rowLandmarks = view === "cpap" ? payload.cpap?.columns.window_days : undefined;

  const pointsByGroup = new Map<string, { t: number; y: number }[]>();
  let xMax = 0;
  for (let i = 0; i < group.length; i++) {
    if (rowLandmarks && rowLandmarks[i] !== landmark) continue;
    let points = pointsByGroup.get(group[i]);
    if (!points) {
      points = [];
      pointsByGroup.set(group[i], points);
    }
    points.push({ t: time_years[i], y: cif_pct[i] });
    xMax = Math.max(xMax, time_years[i]);
  }

  const colors = GROUP_COLORS[view];
  const series = groupOrder.flatMap((id): CifSeries[] => {
    const points = pointsByGroup.get(id);
    if (!points) return [];
    points.sort((a, b) => a.t - b.t);
    return [
      {
        id,
        label: view === "cpap" ? (CPAP_LABELS[id] ?? id) : id,
        color: colors[id],
        dashed: view === "cpap" && id === CPAP_DASHED_GROUP,
        points,
      },
    ];
  });
  const omitted = view === "cpap" && (payload.cpap?.omitted_strata ?? []).some((entry) => entry.window_days === landmark);
  return { series, xMax, omitted };
}

export function IncidenceExplorer(props: {
  view: IncidenceView;
  features: IncidenceFeature[];
  groupOrder: string[];
  windows: string[];
  defaultFeature: string;
  defaultWindow: string;
}) {
  const { view, features, groupOrder, windows, defaultFeature, defaultWindow } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const featureParam = searchParams.get("feature");
  const feature =
    features.find((f) => f.id === featureParam) ?? features.find((f) => f.id === defaultFeature) ?? features[0];
  const windowParam = searchParams.get("window");
  const landmark = view === "cpap" && windowParam !== null && windows.includes(windowParam) ? windowParam : defaultWindow;
  const available = feature.views[view];

  const [loaded, setLoaded] = useState<{ path: string; payload: SurvivalPayload } | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!available) return;
    let active = true;
    const path = feature.path;
    fetchJson<SurvivalPayload>(path).then(
      (payload) => {
        if (!active) return;
        setLoaded({ path, payload });
        setFailedPath(null);
      },
      () => {
        if (active) setFailedPath(path);
      },
    );
    return () => {
      active = false;
    };
  }, [feature.path, available, attempt]);

  const curves = useMemo(
    () => (loaded ? buildCurves(loaded.payload, view, Number(landmark), groupOrder) : null),
    [loaded, view, landmark, groupOrder],
  );

  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
  const chartHeight = wide ? 420 : 300;

  const setParam = (key: "feature" | "window", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const options = features.map((f) => ({ value: f.id, label: f.name, color: categoryColor("phecode", f.category) }));
  const copy = VIEW_COPY[view];
  const current = loaded?.path === feature.path ? loaded.payload : null;
  const severeHr = view === "severity" ? (current?.metadata.severe_hr ?? null) : null;
  const failed = failedPath === feature.path;
  const loading = !current && !failed;

  let body: ReactNode;
  if (!available) {
    body = <p className="py-16 text-[14px] text-muted">Not available for this outcome.</p>;
  } else if (failed) {
    body = (
      <div className="flex flex-col items-start gap-3 py-16" style={{ minHeight: chartHeight }}>
        <p className="text-[14px] text-muted">Couldn&apos;t load curves.</p>
        <button
          type="button"
          onClick={() => {
            setFailedPath(null);
            setAttempt((n) => n + 1);
          }}
          className="inline-flex h-9 items-center rounded-full bg-fill px-4 text-[14px] font-medium transition-colors duration-150 hover:bg-hairline-soft"
        >
          Retry
        </button>
      </div>
    );
  } else if (!curves) {
    body = <div aria-hidden="true" style={{ height: chartHeight + 28 }} />;
  } else if (curves.series.length === 0) {
    body = <p className="py-16 text-[14px] text-muted">Not available for this outcome.</p>;
  } else {
    body = (
      <div
        aria-busy={loading}
        className={`transition-opacity duration-150 ${loading ? "pointer-events-none opacity-40" : "opacity-100"}`}
      >
        <Legend
          items={curves.series.map((s) => ({ label: s.label, color: s.color, shape: s.dashed ? "dashed" : "line" }))}
        />
        <div className="mt-4">
          <CifChart
            series={curves.series}
            xMax={curves.xMax}
            xLabel={copy.xLabel}
            height={chartHeight}
            ariaLabel={`Cumulative incidence of ${feature.name} by ${copy.by}`}
          />
        </div>
        {curves.omitted && <p className="mt-2 text-[12px] text-muted">Some groups omitted for small counts.</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <ComboBox
          label="Outcome"
          value={feature.id}
          options={options}
          onChange={(value) => setParam("feature", value)}
          className="w-full sm:w-[400px]"
        />
        {view === "cpap" && (
          <SegmentedControl
            ariaLabel="Landmark"
            value={landmark}
            options={windows.map((days) => ({ value: days, label: `${days}-day landmark` }))}
            onChange={(value) => setParam("window", value)}
          />
        )}
      </div>

      <section aria-label={feature.name} className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <h2 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.015em]">{feature.name}</h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColor("phecode", feature.category) }}
                />
                {categoryLabel("phecode", feature.category)}
              </span>
              <span className="tabular-nums">PheCode {feature.id}</span>
            </p>
          </div>
          {severeHr !== null && (
            <p className="shrink-0 text-[14px] text-muted">
              Severe vs none HR <span className="font-semibold text-ink tabular-nums">{formatEffect(severeHr, "HR")}</span>
            </p>
          )}
        </div>

        <div className="mt-6">{body}</div>

        <div className="mt-6 flex flex-col items-start gap-4">
          <Link
            href={`/phedas/incidence?feature=${encodeURIComponent(feature.id)}`}
            className="inline-flex h-9 items-center rounded-full bg-fill px-4 text-[14px] font-medium transition-colors duration-150 hover:bg-hairline-soft"
          >
            Association results
          </Link>
          <p className="text-[12px] text-muted">{copy.footnote}</p>
        </div>
      </section>
    </div>
  );
}
