export function Legend(props: {
  items: { label: string; color: string; shape?: "dot" | "line" | "dashed" }[];
  className?: string;
}) {
  const { items, className } = props;
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className ?? ""}`}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          {(item.shape ?? "dot") === "dot" ? (
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          ) : (
            <svg aria-hidden="true" width="16" height="2" viewBox="0 0 16 2" className="shrink-0 overflow-visible">
              <line
                x1="0"
                y1="1"
                x2="16"
                y2="1"
                stroke={item.color}
                strokeWidth="2"
                strokeDasharray={item.shape === "dashed" ? "4 3" : undefined}
              />
            </svg>
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}
