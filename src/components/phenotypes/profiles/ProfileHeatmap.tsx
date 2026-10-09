"use client";

import { useEffect, useState } from "react";
import { OctantGlyph } from "@/components/phenotypes/profiles/OctantGlyph";
import {
  formatMeasure,
  formatSmd,
  formatSpread,
  smdFill,
  type Measure,
  type MeasureDomain,
  type OctantSummary,
} from "@/components/phenotypes/profiles/model";
import { formatInt } from "@/lib/data/format";

interface HoverState {
  measure: Measure;
  octant: OctantSummary;
  x: number;
  y: number;
}

const TOOLTIP_HALF_WIDTH = 110;

export function ProfileHeatmap(props: {
  octants: OctantSummary[];
  domains: MeasureDomain[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { octants, domains, selectedId, onSelect } = props;
  const [hover, setHover] = useState<HoverState | null>(null);
  const hovering = hover !== null;

  // The tooltip is fixed-position; any scroll or resize would detach it from its cell.
  useEffect(() => {
    if (!hovering) return;
    const clear = () => setHover(null);
    window.addEventListener("scroll", clear, { capture: true, passive: true });
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("scroll", clear, { capture: true });
      window.removeEventListener("resize", clear);
    };
  }, [hovering]);

  const hoverCell = hover ? hover.measure.byOctant[hover.octant.id] : null;
  const hoverSpread = hover && hoverCell && !hoverCell.suppressed ? formatSpread(hoverCell, hover.measure) : null;

  return (
    <div className="animate-fade-in">
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[820px] table-fixed border-separate border-spacing-0.5 text-[11px] tabular-nums"
          onPointerLeave={() => setHover(null)}
        >
          <caption className="sr-only">Measures by phenotype, shaded by standardized difference from the cohort</caption>
          <colgroup>
            <col className="w-[140px] sm:w-[200px]" />
            {octants.map((octant) => (
              <col key={octant.id} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-canvas shadow-[2px_0_0_var(--color-canvas)]">
                <span className="sr-only">Measure</span>
              </th>
              {octants.map((octant) => {
                const selected = octant.id === selectedId;
                return (
                  <th key={octant.id} scope="col" className="pb-2 align-bottom font-normal">
                    <button
                      type="button"
                      onClick={() => onSelect(octant.id)}
                      className={`flex w-full flex-col items-center gap-1.5 rounded-[8px] px-1 py-1.5 text-center text-[12px] leading-tight transition-colors duration-150 hover:bg-fill ${
                        selected ? "font-semibold text-ink" : "text-muted hover:text-ink"
                      }`}
                    >
                      <OctantGlyph bits={octant.bits} color={octant.color} size={8} />
                      {octant.label}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          {domains.map((domain) => (
            <tbody key={domain.id}>
              <tr>
                <th scope="rowgroup" colSpan={octants.length + 1} className="pt-4 pb-1 text-left text-[13px] font-semibold">
                  <span className="sticky left-0 inline-block bg-canvas pr-2">{domain.label}</span>
                </th>
              </tr>
              {domain.measures.map((measure) => (
                <tr key={measure.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-canvas pr-3 text-left text-[13px] leading-tight font-normal shadow-[2px_0_0_var(--color-canvas)]"
                  >
                    {measure.label}
                  </th>
                  {octants.map((octant) => {
                    const cell = measure.byOctant[octant.id];
                    const smd = cell.suppressed ? null : cell.smd;
                    const fill = smd === null ? null : smdFill(smd);
                    return (
                      <td
                        key={octant.id}
                        className={`h-7 rounded-[4px] px-1 text-center ${fill?.dark ? "text-white" : fill ? "text-ink" : "text-muted"}`}
                        style={{ backgroundColor: fill?.color ?? "var(--color-fill)" }}
                        onPointerEnter={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setHover({ measure, octant, x: rect.left + rect.width / 2, y: rect.top });
                        }}
                      >
                        {cell.suppressed ? "<11" : formatMeasure(cell.estimate, measure, false)}
                        {smd !== null && <span className="sr-only">, difference {formatSmd(smd)}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted">
        <p>Color shows standardized difference from the cohort.</p>
        <div aria-hidden="true" className="flex items-center gap-2 tabular-nums">
          <span>−1</span>
          <span
            className="h-2 w-28 rounded-full ring-[0.5px] ring-hairline"
            style={{ background: "linear-gradient(to right, #2b6cb0, #ffffff, #c0392b)" }}
          />
          <span>+1</span>
        </div>
      </div>

      {hover && hoverCell && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-40 w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-[8px] bg-canvas px-3 py-2 text-[12px] tabular-nums shadow-[0_4px_16px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.08)] animate-fade-in"
          style={{
            left: Math.min(Math.max(hover.x, TOOLTIP_HALF_WIDTH), window.innerWidth - TOOLTIP_HALF_WIDTH),
            top: hover.y - 6,
          }}
        >
          <p className="text-[13px] font-semibold">{hover.measure.label}</p>
          <p className="text-muted">{hover.octant.label}</p>
          <p className="mt-1.5">
            {hoverCell.suppressed ? "Suppressed (<11)" : formatMeasure(hoverCell.estimate, hover.measure)}
            <span className="text-muted"> vs {formatMeasure(hover.measure.overall.estimate, hover.measure)} cohort</span>
          </p>
          {hoverSpread && <p>{hoverSpread}</p>}
          <p>Difference {hoverCell.suppressed ? "—" : formatSmd(hoverCell.smd)}</p>
          <p className="text-muted">n {formatInt(hoverCell.n)}</p>
        </div>
      )}
    </div>
  );
}
