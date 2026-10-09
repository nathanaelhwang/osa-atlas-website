"use client";

import { useId } from "react";
import { OctantGlyph } from "@/components/phenotypes/profiles/OctantGlyph";
import {
  formatMeasure,
  formatSmd,
  formatSpread,
  type CpapSetup,
  type Measure,
  type MeasureCell,
  type MeasureDomain,
  type OctantSummary,
} from "@/components/phenotypes/profiles/model";
import { formatInt } from "@/lib/data/format";

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_84px_84px] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1.2fr)_96px_96px_minmax(0,1fr)]";
const BAR_CELL = "col-span-3 flex items-center gap-3 sm:col-span-1";

/** Documented setup percent (already 0–100); null rows are suppressed counts and read "<11", never 0. */
function formatSetup(value: number | null | undefined): string {
  if (value === undefined) return "—";
  if (value === null) return "<11";
  return `${value.toFixed(1)}%`;
}

function MeasureRow(props: { measure: Measure; cell: MeasureCell; color: string }) {
  const { measure, cell, color } = props;
  const tooltipId = useId();
  const spread = cell.suppressed ? null : formatSpread(cell, measure);
  const smd = cell.suppressed ? null : cell.smd;
  const magnitude = smd === null ? 0 : Math.min(Math.abs(smd), 1) * 50;

  return (
    <li
      tabIndex={0}
      aria-describedby={tooltipId}
      className={`group relative ${ROW_GRID} border-t border-hairline-soft py-2.5 focus-visible:rounded-[8px]`}
    >
      <span className="min-w-0 text-[15px]">{measure.label}</span>
      {cell.suppressed ? (
        <span className="text-right text-[13px] leading-tight text-muted">Suppressed (&lt;11)</span>
      ) : (
        <span className="text-right text-[15px] tabular-nums">{formatMeasure(cell.estimate, measure)}</span>
      )}
      <span className="text-right text-[15px] text-muted tabular-nums">
        <span className="sr-only">Cohort </span>
        {formatMeasure(measure.overall.estimate, measure)}
      </span>
      <div className={BAR_CELL}>
        <div aria-hidden="true" className="relative h-4 flex-1">
          <span className="absolute inset-y-0 left-1/2 w-px bg-hairline" />
          {smd !== null && (
            <span
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-[2px]"
              style={{ backgroundColor: color, width: `${magnitude}%`, left: smd >= 0 ? "50%" : `${50 - magnitude}%` }}
            />
          )}
          {smd !== null && Math.abs(smd) > 1 && (
            <span className={`absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-ink ${smd > 0 ? "right-0" : "left-0"}`} />
          )}
        </div>
        <span className="w-12 shrink-0 text-right text-[13px] text-muted tabular-nums">
          {smd !== null && <span className="sr-only">Standardized difference </span>}
          {smd !== null && formatSmd(smd)}
        </span>
      </div>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute top-full left-0 z-20 -mt-1 rounded-[8px] bg-canvas px-3 py-2 text-[12px] whitespace-nowrap tabular-nums opacity-0 shadow-[0_4px_16px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.08)] transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
      >
        {spread && <span className="block">{spread}</span>}
        <span className="block text-muted">n {formatInt(cell.n)}</span>
      </span>
    </li>
  );
}

export function ProfileDetail(props: { octant: OctantSummary; domains: MeasureDomain[]; cpap: CpapSetup }) {
  const { octant, domains, cpap } = props;
  const titleId = useId();
  const cpapId = useId();
  const stats = [
    { label: "Patients", value: formatInt(octant.n) },
    { label: "Median AHI", value: octant.medianAhi === null ? "—" : octant.medianAhi.toFixed(1) },
    { label: "Median PheCodes", value: formatInt(octant.medianCodes) },
  ];

  return (
    <div className="animate-fade-in">
      <section aria-labelledby={titleId}>
        <div className="flex items-center gap-3">
          <OctantGlyph bits={octant.bits} color={octant.color} size={12} />
          <h2 id={titleId} className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">
            {octant.label}
          </h2>
        </div>
        <p className="mt-2 text-[17px] text-muted">{octant.summary}</p>

        <dl className="mt-8 grid max-w-[640px] grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse">
              <dt className="text-[13px] text-muted">{stat.label}</dt>
              <dd className="text-[28px] leading-tight font-semibold tracking-[-0.015em] tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 max-w-[960px]">
          <div aria-hidden="true" className={`${ROW_GRID} pb-2 text-[12px] text-muted`}>
            <span />
            <span className="text-right">Phenotype</span>
            <span className="text-right">Cohort</span>
            <div className={BAR_CELL}>
              <div className="relative h-4 flex-1 tabular-nums">
                <span className="absolute left-0">−1</span>
                <span className="absolute left-1/2 -translate-x-1/2">0</span>
                <span className="absolute right-0">+1</span>
              </div>
              <span className="w-12 shrink-0" />
            </div>
          </div>
          {domains.map((domain) => (
            <section key={domain.id} className="mt-6">
              <h3 className="mb-1 text-[17px] font-semibold">{domain.label}</h3>
              <ul>
                {domain.measures.map((measure) => (
                  <MeasureRow key={measure.id} measure={measure} cell={measure.byOctant[octant.id]} color={octant.color} />
                ))}
              </ul>
            </section>
          ))}
          <p className="mt-6 text-[12px] text-muted">Bars show standardized difference from the cohort.</p>
        </div>
      </section>

      <section aria-labelledby={cpapId} className="mt-14 max-w-[960px]">
        <h3 id={cpapId} className="text-[17px] font-semibold">
          CPAP setup
        </h3>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-5">
          {cpap.windows.map((cpapWindow) => (
            <div key={cpapWindow.id}>
              <dt className="text-[13px] text-muted">{cpapWindow.label}</dt>
              <dd className="mt-1 tabular-nums">
                <span className="block text-[21px] leading-tight font-semibold">
                  {formatSetup(cpap.setupPct[octant.id]?.[cpapWindow.id])}
                </span>
                <span className="mt-0.5 block text-[12px] text-muted">
                  Cohort {formatSetup(cpap.setupPct.overall?.[cpapWindow.id])}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
