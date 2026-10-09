import { OctantGlyph } from "@/components/phenotypes/profiles/OctantGlyph";
import type { OutcomeOctant, OutcomePanel } from "@/components/phenotypes/outcomes/types";
import { formatCI, formatEffect } from "@/lib/data/format";
import { OCTANT_COLORS } from "@/lib/palettes";

/** Candidate log-axis bounds; the domain snaps outward to these. */
const DOMAIN_STOPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const MAJOR_TICKS = [0.25, 0.5, 1, 2, 4];
const LEGEND_COLOR = "#6e6e73";
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.5rem] gap-2 px-3 sm:grid-cols-[13.5rem_minmax(0,1fr)_6.5rem]";

function logDomain(panels: OutcomePanel[]): [number, number] {
  let lo = 1;
  let hi = 1;
  for (const panel of panels) {
    if (panel.ciLow !== null && panel.ciLow > 0) lo = Math.min(lo, panel.ciLow);
    if (panel.ciHigh !== null) hi = Math.max(hi, panel.ciHigh);
  }
  const start = DOMAIN_STOPS.findLast((stop) => stop <= lo) ?? lo;
  const end = DOMAIN_STOPS.find((stop) => stop >= hi) ?? hi;
  return [start, end];
}

function Marker(props: { color: string; sigBon: boolean; sigFdr: boolean; cx: number | string; cy: number | string; r: number }) {
  const { color, sigBon, sigFdr, cx, cy, r } = props;
  if (sigBon) return <circle cx={cx} cy={cy} r={r} fill={color} stroke={color} strokeWidth={1.5} />;
  if (sigFdr) return <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.75} />;
  return <circle cx={cx} cy={cy} r={r} fill="white" stroke={color} strokeWidth={1.5} />;
}

export function ForestPlot(props: {
  octants: OutcomeOctant[];
  panels: OutcomePanel[];
  selected: string;
  onSelect: (octant: string) => void;
}) {
  const { octants, panels, selected, onSelect } = props;
  const [start, end] = logDomain(panels);
  const span = Math.log(end) - Math.log(start);
  const pct = (v: number) => {
    const clamped = Math.min(end, Math.max(start, v));
    return span > 0 ? ((Math.log(clamped) - Math.log(start)) / span) * 100 : 50;
  };
  const ticks = [start, ...MAJOR_TICKS.filter((tick) => tick > start && tick < end), end];
  const reference = `${pct(1)}%`;

  return (
    <div>
      <div className={`${ROW_GRID} pb-1 text-[12px] text-muted`}>
        <span className="col-start-3 text-right">HR (95% CI)</span>
      </div>
      <div role="group" aria-label="Hazard ratios by phenotype">
        {octants.map((octant) => {
          const panel = panels.find((candidate) => candidate.octant === octant.id);
          const color = OCTANT_COLORS[octant.id];
          const isSelected = octant.id === selected;
          const hr = formatEffect(panel?.hr ?? null, "HR");
          const ci = formatCI(panel?.ciLow ?? null, panel?.ciHigh ?? null, "HR");
          const significance = panel?.sigBon ? ", Bonferroni significant" : panel?.sigFdr ? ", FDR significant" : "";
          return (
            <button
              key={octant.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${octant.label}, HR ${hr} (${ci})${significance}`}
              onClick={() => onSelect(octant.id)}
              className={`${ROW_GRID} min-h-9 w-full items-center rounded-[10px] text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent motion-reduce:transition-none ${
                isSelected ? "bg-fill" : "hover:bg-fill/60"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <OctantGlyph bits={octant.bits} color={color} size={8} />
                <span className={`line-clamp-2 text-[13px] leading-tight ${isSelected ? "font-medium" : ""}`}>
                  {octant.label}
                </span>
              </span>
              <svg aria-hidden="true" className="h-9 w-full overflow-visible">
                <line x1={reference} x2={reference} y1={0} y2="100%" stroke="#86868b" strokeWidth={1} strokeDasharray="3 3" />
                {panel && panel.hr !== null && (
                  <>
                    {panel.ciLow !== null && panel.ciHigh !== null && (
                      <line
                        x1={`${pct(panel.ciLow)}%`}
                        x2={`${pct(panel.ciHigh)}%`}
                        y1="50%"
                        y2="50%"
                        stroke={color}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                      />
                    )}
                    <Marker
                      color={color}
                      sigBon={panel.sigBon}
                      sigFdr={panel.sigFdr}
                      cx={`${pct(panel.hr)}%`}
                      cy="50%"
                      r={4.5}
                    />
                  </>
                )}
              </svg>
              <span className="text-right text-[12px] whitespace-nowrap text-ink tabular-nums">
                {panel?.hr == null ? "—" : `${hr} (${ci})`}
              </span>
            </button>
          );
        })}
      </div>
      <div className={ROW_GRID} aria-hidden="true">
        <svg className="col-start-2 h-6 w-full overflow-visible">
          <line x1={0} x2="100%" y1={0.5} y2={0.5} className="stroke-hairline" strokeWidth={1} />
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={`${pct(tick)}%`} x2={`${pct(tick)}%`} y1={0} y2={4} className="stroke-hairline" strokeWidth={1} />
              <text x={`${pct(tick)}%`} y={18} textAnchor="middle" className="fill-muted text-[12px] tabular-nums">
                {tick}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <ul className="mt-4 flex gap-4 px-3 text-[12px] text-muted">
        <li className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="10" height="10" className="overflow-visible">
            <Marker color={LEGEND_COLOR} sigBon sigFdr cx={5} cy={5} r={4} />
          </svg>
          Bonferroni
        </li>
        <li className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="10" height="10" className="overflow-visible">
            <Marker color={LEGEND_COLOR} sigBon={false} sigFdr cx={5} cy={5} r={4} />
          </svg>
          FDR
        </li>
      </ul>
    </div>
  );
}
