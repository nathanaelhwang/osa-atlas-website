/** Source octant labels are title case ("Hypoxemia Predominant"); the site uses sentence case. */
export function octantLabel(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

/** Three squares in axis order (physiology, symptoms, comorbidity): filled where the octant is above the median. */
export function OctantGlyph(props: { bits: number[]; color: string; size?: number }) {
  const { bits, color, size = 10 } = props;
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 gap-[3px]">
      {bits.map((bit, index) => (
        <span
          key={index}
          className={`rounded-[2px] ${bit ? "" : "border border-hairline"}`}
          style={{ width: size, height: size, backgroundColor: bit ? color : undefined }}
        />
      ))}
    </span>
  );
}
