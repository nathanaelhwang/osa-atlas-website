import { useEffect, useState } from "react";
import { CifChart, type CifSeries } from "@/components/charts/CifChart";
import type { CurveArrays, CurvePayload, OutcomePanel, RiskRow } from "@/components/phenotypes/outcomes/types";
import { Legend } from "@/components/ui/Legend";
import { fetchJson } from "@/lib/data/client";
import { formatCI, formatEffect, formatInt, formatP } from "@/lib/data/format";
import { NO_OSA_COLOR } from "@/lib/palettes";

const OTHER_SEVEN_COLOR = "#86868b";
const CHART_HEIGHT = 360;
const X_MAX_YEARS = 3;

function toSeries(id: string, label: string, color: string, curve: CurveArrays, dashed = false): CifSeries {
  return {
    id,
    label,
    color,
    dashed,
    points: curve.time_years.map((t, i) => ({ t, y: curve.cif_pct[i] })),
    band: curve.time_years.map((t, i) => ({ t, lo: curve.ci_low_pct[i], hi: curve.ci_high_pct[i] })),
  };
}

interface RiskLine {
  id: string;
  label: string;
  color: string;
  rows: RiskRow[];
}

export function OutcomeCurves(props: {
  path: string;
  outcomeName: string;
  octant: { id: string; label: string; color: string };
  panel: OutcomePanel | undefined;
}) {
  const { path, outcomeName, octant, panel } = props;
  const [attempt, setAttempt] = useState(0);
  const key = `${path}#${attempt}`;
  const [loaded, setLoaded] = useState<{ key: string; payload: CurvePayload } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson<CurvePayload>(path).then(
      (payload) => {
        if (active) setLoaded({ key, payload });
      },
      () => {
        if (active) setFailedKey(key);
      },
    );
    return () => {
      active = false;
    };
  }, [path, key]);

  const failed = failedKey === key;
  const loading = !failed && loaded?.key !== key;
  const payload = loaded?.payload ?? null;
  const curvePanel = payload?.panels.find((candidate) => candidate.octant === octant.id);
  const noOsa = payload?.no_osa ?? null;
  const focalCurve = curvePanel?.curve_status === "available" ? curvePanel.curves?.focal : null;
  const otherCurve = curvePanel?.curve_status === "available" ? curvePanel.curves?.other_seven : null;
  const noOsaCurve = noOsa?.curve_status === "available" ? noOsa.curve : null;

  const series: CifSeries[] = [];
  if (focalCurve && otherCurve) {
    series.push(toSeries("focal", octant.label, octant.color, focalCurve));
    series.push(toSeries("other-seven", "Other seven", OTHER_SEVEN_COLOR, otherCurve));
    if (noOsaCurve) series.push(toSeries("no-osa", "No OSA", NO_OSA_COLOR, noOsaCurve, true));
  }

  const riskLines: RiskLine[] = [];
  if (curvePanel?.risk_table?.focal) {
    riskLines.push({ id: "focal", label: octant.label, color: octant.color, rows: curvePanel.risk_table.focal });
  }
  if (curvePanel?.risk_table?.other_seven) {
    riskLines.push({
      id: "other-seven",
      label: "Other seven",
      color: OTHER_SEVEN_COLOR,
      rows: curvePanel.risk_table.other_seven,
    });
  }
  if (noOsa?.risk_table) riskLines.push({ id: "no-osa", label: "No OSA", color: NO_OSA_COLOR, rows: noOsa.risk_table });
  const times = riskLines[0]?.rows.map((row) => row.time_years) ?? [];

  const logrankP = curvePanel?.logrank_p ?? null;
  const hrText =
    panel && panel.hr !== null
      ? `HR ${formatEffect(panel.hr, "HR")} (${formatCI(panel.ciLow, panel.ciHigh, "HR")})`
      : null;

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-[14px] text-muted" style={{ height: CHART_HEIGHT }}>
        <p>Couldn&rsquo;t load curves.</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="h-8 rounded-full bg-fill px-4 text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-hairline-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      aria-busy={loading}
      className={`transition-opacity duration-150 motion-reduce:transition-none ${loading && payload ? "opacity-40" : ""}`}
    >
      <Legend
        className="min-h-[18px]"
        items={series.map((s) => ({ label: s.label, color: s.color, shape: s.dashed ? "dashed" : "line" }))}
      />
      <div className="mt-3" style={{ height: CHART_HEIGHT }}>
        {payload &&
          (series.length > 0 ? (
            <CifChart
              series={series}
              xMax={X_MAX_YEARS}
              height={CHART_HEIGHT}
              ariaLabel={`${outcomeName} cumulative incidence: ${octant.label} vs other seven`}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-[18px] bg-fill px-6 text-center text-[14px] text-muted">
              Curve withheld for small counts.
            </div>
          ))}
      </div>

      {riskLines.length > 0 && (
        <table className="mt-6 w-full table-fixed text-[12px] tabular-nums">
          <thead>
            <tr className="text-muted">
              <th scope="col" className="pb-1.5 text-left font-normal">
                At risk
              </th>
              {times.map((t) => (
                <th key={t} scope="col" className="w-[15%] pb-1.5 text-right font-normal">
                  {t} yr
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {riskLines.map((line) => (
              <tr key={line.id} className="border-t border-hairline-soft">
                <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: line.color }} />
                    <span className="truncate">{line.label}</span>
                  </span>
                </th>
                {times.map((t) => {
                  const row = line.rows.find((candidate) => candidate.time_years === t);
                  const value =
                    row?.n_at_risk == null ? (row?.suppressed ? "<11" : "—") : formatInt(row.n_at_risk);
                  return (
                    <td key={t} className="py-1.5 text-right">
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(logrankP !== null || hrText !== null) && (
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted tabular-nums">
          {logrankP !== null && <span>Log-rank p {formatP(logrankP)}</span>}
          {hrText !== null && <span>{hrText}</span>}
        </p>
      )}
    </div>
  );
}
