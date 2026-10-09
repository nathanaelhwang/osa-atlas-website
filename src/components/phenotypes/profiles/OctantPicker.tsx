import { OctantGlyph } from "@/components/phenotypes/profiles/OctantGlyph";
import type { OctantSummary } from "@/components/phenotypes/profiles/model";
import { formatInt, formatPct } from "@/lib/data/format";

const AXES = ["Physiology", "Symptoms", "Comorbidity"];

export function OctantPicker(props: { octants: OctantSummary[]; selectedId: string; onSelect: (id: string) => void }) {
  const { octants, selectedId, onSelect } = props;
  return (
    <div>
      <ul className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-muted">
        {AXES.map((axis, index) => (
          <li key={axis} className="inline-flex items-center gap-2">
            <OctantGlyph bits={AXES.map((_, i) => (i === index ? 1 : 0))} color="var(--color-ink)" size={8} />
            {axis}
          </li>
        ))}
        <li>Filled: above median</li>
      </ul>
      <div role="group" aria-label="Phenotype" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {octants.map((octant) => {
          const selected = octant.id === selectedId;
          return (
            <button
              key={octant.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(octant.id)}
              className={`flex flex-col gap-1 rounded-[18px] border p-4 text-left transition-colors duration-150 ${
                selected ? "border-ink shadow-[inset_0_0_0_0.5px_var(--color-ink)]" : "border-hairline hover:border-muted"
              }`}
            >
              <span className="flex items-start gap-2.5">
                <span className="flex h-5 shrink-0 items-center">
                  <OctantGlyph bits={octant.bits} color={octant.color} />
                </span>
                <span className="text-[15px] leading-5 font-semibold">{octant.label}</span>
              </span>
              <span className="text-[13px] text-muted tabular-nums">
                {formatInt(octant.n)} ({formatPct(octant.pct, 1)})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
