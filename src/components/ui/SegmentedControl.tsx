"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import type { SelectOption } from "@/components/ui/Select";

type SegmentSize = "sm" | "md";

export const SEGMENT_ITEM_CLASS: Record<SegmentSize, string> = {
  md: "h-7 px-4 text-[14px]",
  sm: "h-6 px-3 text-[13px]",
};

/** Shared track + sliding thumb for SegmentedControl and TabLinks. Segments share equal widths. */
export function SegmentTrack(props: {
  count: number;
  activeIndex: number;
  size: SegmentSize;
  role?: "radiogroup";
  ariaLabel?: string;
  children: ReactNode;
}) {
  const { count, activeIndex, size, role, ariaLabel, children } = props;
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={`relative inline-grid max-w-full rounded-full bg-fill p-0.5 ${size === "sm" ? "h-7" : "h-8"}`}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {activeIndex >= 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-canvas shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] transition-transform duration-[240ms] ease-apple"
          style={{
            width: `calc((100% - 4px) / ${count})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

export function SegmentedControl(props: {
  ariaLabel: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  size?: "sm" | "md";
}) {
  const { ariaLabel, value, options, onChange, size = "md" } = props;
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = options.findIndex((option) => option.value === value);
  const tabStop = activeIndex >= 0 ? activeIndex : options.findIndex((option) => !option.disabled);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    for (let offset = 1; offset < options.length; offset++) {
      const next = (index + step * offset + options.length) % options.length;
      if (options[next].disabled) continue;
      buttonRefs.current[next]?.focus();
      onChange(options[next].value);
      return;
    }
  };

  return (
    <SegmentTrack count={options.length} activeIndex={activeIndex} size={size} role="radiogroup" ariaLabel={ariaLabel}>
      {options.map((option, index) => {
        const checked = index === activeIndex;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={option.disabled || undefined}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => {
              if (!option.disabled && !checked) onChange(option.value);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`relative z-10 truncate rounded-full font-medium whitespace-nowrap transition-colors duration-150 ${SEGMENT_ITEM_CLASS[size]} ${
              option.disabled ? "cursor-default text-muted/50" : checked ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </SegmentTrack>
  );
}
