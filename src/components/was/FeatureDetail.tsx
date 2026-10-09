import Link from "next/link";
import type { ReactNode } from "react";
import { formatCI, formatEffect, formatInt, formatP } from "@/lib/data/format";
import { EFFECT_LABELS } from "@/lib/data/labels";
import type { AssocRow, EffectType } from "@/lib/data/types";

export interface FeatureDetailProps {
  row: AssocRow;
  effectType: EffectType;
  directional: boolean;
  /** Plot group (category or subgroup) the row is colored by. */
  group: { label: string; color: string };
  /** Secondary grouping (setting, procedure class), or null when absent or already shown as the group. */
  subgroup: string | null;
  incidenceHref: string | null;
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline-soft py-3">
      <dt className="text-muted">{props.label}</dt>
      <dd className="text-right tabular-nums">{props.children}</dd>
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  if (!value) return <span className="text-muted">No</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-ink">
      <svg aria-hidden="true" width="11" height="9" viewBox="0 0 11 9" className="fill-none stroke-ink">
        <path d="M1 4.5l3 3L10 1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Yes
    </span>
  );
}

export function FeatureDetail(props: FeatureDetailProps) {
  const { row, effectType, directional, group, subgroup, incidenceHref } = props;
  const showCI = directional && row.ciLow !== null && row.ciHigh !== null;
  // A ratio on a non-directional (omnibus) partition does not estimate the omnibus contrast.
  const showEffect = directional || effectType === "wald_F" || effectType === "wald_chi2";

  return (
    <div className="pt-1">
      <h2 className="text-[28px] leading-[1.12] font-semibold tracking-[-0.015em] text-balance">{row.name}</h2>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
          {group.label}
        </span>
        {row.id !== row.name && <span className="text-muted tabular-nums">{row.id}</span>}
        {subgroup && <span className="text-muted">{subgroup}</span>}
      </p>

      {showEffect && (
        <div className="mt-8">
          <p className="text-[13px] text-muted">{EFFECT_LABELS[effectType].long}</p>
          <p className="mt-1 text-[44px] leading-none font-medium tracking-[-0.02em] tabular-nums">
            {formatEffect(row.effect, effectType)}
          </p>
          {showCI && (
            <p className="mt-2 text-[14px] text-muted tabular-nums">
              95% CI {formatCI(row.ciLow, row.ciHigh, effectType)}
            </p>
          )}
        </div>
      )}

      <dl className="mt-8 border-t border-hairline-soft text-[14px]">
        <Field label="p-value">{formatP(row.p, row.pZero)}</Field>
        <Field label="FDR">
          <YesNo value={row.sigFdr} />
        </Field>
        <Field label="Bonferroni">
          <YesNo value={row.sigBon} />
        </Field>
        {row.n !== null && <Field label="N">{formatInt(row.n)}</Field>}
        {row.nEvents !== null && <Field label="Events">{formatInt(row.nEvents)}</Field>}
      </dl>
      {row.unstable && <p className="mt-3 text-[12px] text-muted">Unstable estimate</p>}

      {incidenceHref && (
        <Link
          href={incidenceHref}
          className="mt-8 inline-flex h-9 items-center rounded-full bg-fill px-4 text-[14px] font-medium transition-colors duration-150 hover:bg-hairline-soft"
        >
          Incidence curve
        </Link>
      )}
    </div>
  );
}
