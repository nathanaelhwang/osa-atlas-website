import { scaleLinear } from "d3-scale";

/** Group span on the x axis; all values in [0, 1]. */
export interface ManhattanGroup {
  id: string;
  start: number;
  end: number;
  center: number;
}

export interface ManhattanLayout<T> {
  points: { row: T; x: number }[];
  groups: ManhattanGroup[];
}

const naturalCollator = new Intl.Collator(undefined, { numeric: true });

/**
 * Groups rows by `groupOf` in `groupOrder` (unknown groups appended alphabetically), sorts each group by natural id order,
 * and assigns x in [0, 1]: each group's span is proportional to its row count, with a fixed `gap` fraction between groups.
 * Rows that are not plottable must be excluded upstream.
 */
export function manhattanLayout<T>(
  rows: T[],
  groupOf: (r: T) => string,
  idOf: (r: T) => string,
  groupOrder: string[],
  gap = 0.012,
): ManhattanLayout<T> {
  const byGroup = new Map<string, T[]>();
  for (const row of rows) {
    const group = groupOf(row);
    const members = byGroup.get(group);
    if (members) members.push(row);
    else byGroup.set(group, [row]);
  }

  const known = groupOrder.filter((g) => byGroup.has(g));
  const knownSet = new Set(known);
  const unknown = [...byGroup.keys()].filter((g) => !knownSet.has(g)).sort((a, b) => a.localeCompare(b));
  const orderedGroups = [...known, ...unknown];

  const totalGap = gap * Math.max(0, orderedGroups.length - 1);
  const unit = rows.length > 0 ? (1 - totalGap) / rows.length : 0;

  const points: { row: T; x: number }[] = [];
  const groups: ManhattanGroup[] = [];
  let cursor = 0;
  for (const id of orderedGroups) {
    const members = byGroup.get(id) ?? [];
    members.sort((a, b) => naturalCollator.compare(idOf(a), idOf(b)));
    const start = cursor;
    const end = start + members.length * unit;
    members.forEach((row, i) => points.push({ row, x: start + (i + 0.5) * unit }));
    groups.push({ id, start, end, center: (start + end) / 2 });
    cursor = end + gap;
  }

  return { points, groups };
}

/** capped (cap 50) when any p underflowed or max nlp > 60; otherwise a nice ceiling of max nlp, at least 5. */
export function yCap(rows: { nlp: number | null; pZero: boolean }[]): { cap: number; capped: boolean } {
  let max = 0;
  for (const row of rows) {
    if (row.pZero) return { cap: 50, capped: true };
    if (row.nlp !== null && Number.isFinite(row.nlp) && row.nlp > max) max = row.nlp;
  }
  if (max > 60) return { cap: 50, capped: true };
  const cap = scaleLinear().domain([0, Math.max(5, max)]).nice().domain()[1];
  return { cap, capped: false };
}
