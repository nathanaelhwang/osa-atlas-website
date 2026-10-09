"use client";

import { useId } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function Select(props: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  className?: string;
  hideLabel?: boolean;
}) {
  const { label, value, options, onChange, className, hideLabel = false } = props;
  const id = useId();
  const selected = options.find((option) => option.value === value);

  return (
    <div className={`inline-flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "shrink-0 text-[13px] text-muted"}>
        {label}
      </label>
      <span className="relative inline-flex h-9 min-w-0 items-center rounded-full bg-fill transition-colors duration-150 hover:bg-hairline-soft has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-accent">
        <span aria-hidden="true" className="truncate pr-9 pl-4 text-[14px] font-medium">
          {selected?.label ?? ""}
        </span>
        <svg
          aria-hidden="true"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          className="pointer-events-none absolute right-4 fill-none stroke-ink"
        >
          <path d="M1 1l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 w-full cursor-pointer appearance-none rounded-full text-[16px] opacity-0 outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}
