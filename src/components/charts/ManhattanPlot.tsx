"use client";

import { scaleLinear } from "d3-scale";
import { useMemo } from "react";
import { manhattanLayout, yCap, type ManhattanGroup } from "@/lib/plot/manhattan";
import {
  AssocPlotCanvas,
  cappedNlp,
  isPlottable,
  plotPoint,
  useElementWidth,
  usePlotHeight,
  GUIDE_COLOR,
  YAxis,
  type AssocPlotProps,
  type PlotMargin,
} from "./plot-shared";

export type { AssocPlotProps } from "./plot-shared";

const GROUP_GAP = 0.012;
const OPACITY_BY_TIER = [0.35, 0.85, 1] as const;
const LABEL_DEGREES = 35;
const LABEL_ANGLE = (LABEL_DEGREES * Math.PI) / 180;
/** Labels always get this many characters (room permitting at the left edge)... */
const LABEL_MIN_CHARS = 18;
/** ...and up to this many when neighbouring labels are far apart. */
const LABEL_MAX_CHARS = 32;
/** Approximate advance of one 11px character. */
const CHAR_WIDTH = 6;
/** Gap between the group dot and its label. */
const LABEL_INSET = 7;
/** Horizontal distance between rotated labels that keeps 11px lines from overlapping. */
const LABEL_SPACING = 21;
const MIN_LABEL_GROUP_WIDTH = 10;
const SIDE_MARGIN = { top: 28, right: 12, left: 40 };

interface GroupTick {
  id: string;
  x: number;
  label: string;
  full: string;
  color: string;
}

/**
 * Visible group labels: when crowded, skip very narrow groups, then keep labels at least LABEL_SPACING apart.
 * Each label gets LABEL_MIN_CHARS, more (up to LABEL_MAX_CHARS) when its nearest shown neighbour is far away,
 * and is shortened so the rotated text stays inside the plot's left edge.
 */
function groupTicks(
  groups: ManhattanGroup[],
  innerWidth: number,
  groupLabel: (group: string) => string,
  colorOfGroup: Map<string, string>,
): GroupTick[] {
  const crowded = groups.length * LABEL_SPACING > innerWidth;
  const shown: { group: ManhattanGroup; x: number }[] = [];
  let lastX = -Infinity;
  for (const group of groups) {
    if (crowded && (group.end - group.start) * innerWidth < MIN_LABEL_GROUP_WIDTH) continue;
    const x = group.center * innerWidth;
    if (x - lastX < LABEL_SPACING) continue;
    lastX = x;
    shown.push({ group, x });
  }

  const charSpan = CHAR_WIDTH * Math.cos(LABEL_ANGLE);
  return shown.map(({ group, x }, index) => {
    const previous = index > 0 ? shown[index - 1].x : -Infinity;
    const next = index < shown.length - 1 ? shown[index + 1].x : Infinity;
    const spacing = Math.min(x - previous, next - x, innerWidth);
    const edgeChars = Math.floor((SIDE_MARGIN.left + x - LABEL_INSET) / charSpan);
    const chars = Math.min(LABEL_MAX_CHARS, edgeChars, Math.max(LABEL_MIN_CHARS, Math.floor(spacing / charSpan)));
    const full = groupLabel(group.id);
    let label = full;
    if (full.length > chars) label = chars < 4 ? "" : `${full.slice(0, chars - 1).trimEnd()}…`;
    return { id: group.id, x, label, full, color: colorOfGroup.get(group.id) ?? "#939393" };
  });
}

export function ManhattanPlot(props: AssocPlotProps) {
  const { rows, partition, colorOf, groupOf, groupOrder, groupLabel, selectedKey, onSelect } = props;
  const height = usePlotHeight(props.height);
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const { directional, neutral, bonferroniNlp, effectType } = partition;

  const plottable = useMemo(() => rows.filter(isPlottable), [rows]);
  const { cap, capped } = useMemo(() => yCap(plottable), [plottable]);
  const layout = useMemo(
    () => manhattanLayout(plottable, groupOf, (row) => row.id, groupOrder, GROUP_GAP),
    [plottable, groupOf, groupOrder],
  );

  const innerWidth = Math.max(0, width - SIDE_MARGIN.left - SIDE_MARGIN.right);
  const ticks = useMemo(() => {
    const colorOfGroup = new Map<string, string>();
    for (const { row } of layout.points) {
      const group = groupOf(row);
      if (!colorOfGroup.has(group)) colorOfGroup.set(group, colorOf(row));
    }
    return groupTicks(layout.groups, innerWidth, groupLabel, colorOfGroup);
  }, [layout, innerWidth, groupLabel, groupOf, colorOf]);

  // Rotated labels hang below the axis; reserve their vertical extent.
  const longest = ticks.reduce((most, tick) => Math.max(most, tick.label.length), 0);
  const labelDepth = Math.ceil((longest * CHAR_WIDTH + LABEL_INSET + 3) * Math.sin(LABEL_ANGLE));
  const margin: PlotMargin = { ...SIDE_MARGIN, bottom: 16 + labelDepth };
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const y = useMemo(() => scaleLinear().domain([0, cap]).range([innerHeight, 0]), [cap, innerHeight]);

  const points = useMemo(
    () =>
      layout.points.map(({ row, x }) =>
        plotPoint(row, x * innerWidth, y(cappedNlp(row, cap)), colorOf(row), { directional, neutral }, OPACITY_BY_TIER),
      ),
    [layout, innerWidth, y, cap, colorOf, directional, neutral],
  );

  const halfGap = (GROUP_GAP / 2) * innerWidth;
  const bonferroniY = bonferroniNlp !== null && bonferroniNlp > 0 && bonferroniNlp <= cap ? y(bonferroniNlp) : null;

  const backdrop = (
    <>
      {layout.groups.map((group, index) =>
        index % 2 === 1 ? (
          <rect
            key={group.id}
            x={group.start * innerWidth - halfGap}
            width={(group.end - group.start) * innerWidth + 2 * halfGap}
            y={0}
            height={innerHeight}
            fill="#f5f5f7"
            fillOpacity={0.7}
          />
        ) : null,
      )}
      <YAxis ticks={y.ticks(5)} y={y} innerWidth={innerWidth} margin={margin} cap={cap} capped={capped} />
      {bonferroniY !== null && (
        <line
          x1={0}
          x2={innerWidth}
          y1={bonferroniY}
          y2={bonferroniY}
          stroke={GUIDE_COLOR}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
      {ticks.map((tick) => (
        <g key={tick.id} transform={`translate(${tick.x},${innerHeight + 10}) rotate(${-LABEL_DEGREES})`}>
          <circle r={3} fill={tick.color} />
          {tick.label && (
            <text x={-LABEL_INSET} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
              {tick.label !== tick.full && <title>{tick.full}</title>}
              {tick.label}
            </text>
          )}
        </g>
      ))}
    </>
  );

  return (
    <AssocPlotCanvas
      containerRef={containerRef}
      width={width}
      height={height}
      margin={margin}
      points={points}
      backdrop={backdrop}
      foreground={
        bonferroniY !== null && (
          <text
            x={innerWidth - 4}
            y={bonferroniY - 5}
            textAnchor="end"
            stroke="#fff"
            strokeWidth={3}
            strokeLinejoin="round"
            paintOrder="stroke"
            pointerEvents="none"
            className="fill-muted text-[11px]"
          >
            Bonferroni
          </text>
        )
      }
      ariaLabel={`Manhattan plot, ${points.length.toLocaleString("en-US")} features. Use arrow keys to move between points.`}
      selectedKey={selectedKey}
      onSelect={onSelect}
      effectType={effectType}
      categoryOf={(row) => groupLabel(groupOf(row))}
      guideTo={innerHeight}
    />
  );
}
