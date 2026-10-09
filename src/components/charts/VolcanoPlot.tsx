"use client";

import { scaleLinear } from "d3-scale";
import { useMemo } from "react";
import type { AssocRow } from "@/lib/data/types";
import { EFFECT_LABELS } from "@/lib/data/labels";
import { yCap } from "@/lib/plot/manhattan";
import {
  AssocPlotCanvas,
  cappedNlp,
  isPlottable,
  plotPoint,
  useElementWidth,
  usePlotHeight,
  YAxis,
  type AssocPlotProps,
  type PlotMargin,
} from "./plot-shared";

export type { AssocPlotProps } from "./plot-shared";

const OPACITY_BY_TIER = [0.25, 1, 1] as const;
const MARGIN: PlotMargin = { top: 28, right: 12, bottom: 44, left: 40 };

/** Only meaningful for directional partitions (the template renders it only then). */
export function VolcanoPlot(props: AssocPlotProps) {
  const { rows, partition, colorOf, groupOf, groupLabel, selectedKey, onSelect } = props;
  const height = usePlotHeight(props.height);
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const { directional, neutral, logScale, effectType } = partition;

  // Plottable rows with their x value (log2 for ratio effects), in x order for keyboard navigation.
  const entries = useMemo(() => {
    const result: { row: AssocRow; value: number }[] = [];
    for (const row of rows) {
      if (!isPlottable(row) || row.effect === null) continue;
      if (logScale && !(row.effect > 0)) continue;
      result.push({ row, value: logScale ? Math.log2(row.effect) : row.effect });
    }
    return result.sort((a, b) => a.value - b.value);
  }, [rows, logScale]);

  const { cap, capped } = useMemo(() => yCap(entries.map((entry) => entry.row)), [entries]);
  const maxAbs = entries.reduce((most, entry) => Math.max(most, Math.abs(entry.value)), 0);
  const extent = maxAbs > 0 ? maxAbs * 1.08 : 1;

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const x = useMemo(() => scaleLinear().domain([-extent, extent]).nice().range([0, innerWidth]), [extent, innerWidth]);
  const y = useMemo(() => scaleLinear().domain([0, cap]).range([innerHeight, 0]), [cap, innerHeight]);

  const points = useMemo(
    () =>
      entries.map(({ row, value }) =>
        plotPoint(row, x(value), y(cappedNlp(row, cap)), colorOf(row), { directional, neutral }, OPACITY_BY_TIER),
      ),
    [entries, x, y, cap, colorOf, directional, neutral],
  );

  const xTicks = x.ticks(Math.max(3, Math.floor(innerWidth / 70)));
  const xTickFormat = x.tickFormat(xTicks.length);
  const effectShort = EFFECT_LABELS[effectType].short;

  const backdrop = (
    <>
      <YAxis ticks={y.ticks(5)} y={y} innerWidth={innerWidth} margin={MARGIN} cap={cap} capped={capped} />
      <line x1={x(0)} x2={x(0)} y1={0} y2={innerHeight} className="stroke-hairline" strokeWidth={1} shapeRendering="crispEdges" />
      {xTicks.map((tick) => (
        <text key={tick} x={x(tick)} y={innerHeight + 18} textAnchor="middle" className="fill-muted text-[12px] tabular-nums">
          {xTickFormat(tick)}
        </text>
      ))}
      <text x={innerWidth / 2} y={innerHeight + 38} textAnchor="middle" className="fill-muted text-[12px]">
        {logScale ? `log₂ ${effectShort}` : effectShort}
      </text>
    </>
  );

  return (
    <AssocPlotCanvas
      containerRef={containerRef}
      width={width}
      height={height}
      margin={MARGIN}
      points={points}
      backdrop={backdrop}
      ariaLabel={`Volcano plot, ${points.length.toLocaleString("en-US")} features. Use arrow keys to move between points.`}
      selectedKey={selectedKey}
      onSelect={onSelect}
      effectType={effectType}
      categoryOf={(row) => groupLabel(groupOf(row))}
      guideTo={null}
    />
  );
}
