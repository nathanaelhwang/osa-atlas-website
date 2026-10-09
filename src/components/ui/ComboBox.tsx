"use client";

import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SelectOption } from "@/components/ui/Select";

type ComboOption = SelectOption & { group?: string; color?: string };

interface OptionGroup {
  name: string | undefined;
  options: { option: ComboOption; index: number }[];
}

function groupOptions(options: ComboOption[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  options.forEach((option, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === option.group) last.options.push({ option, index });
    else groups.push({ name: option.group, options: [{ option, index }] });
  });
  return groups;
}

export function ComboBox(props: {
  label: string;
  value: string;
  options: ComboOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { label, value, options, onChange, placeholder = "Search", className } = props;
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? options.filter(
        (option) => option.label.toLowerCase().includes(needle) || (option.group ?? "").toLowerCase().includes(needle),
      )
    : options;
  const groups = groupOptions(filtered);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openList = () => {
    if (open) return;
    setOpen(true);
    setQuery("");
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value && !option.disabled)));
  };

  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  const choose = (option: ComboOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
  };

  const move = (step: 1 | -1) => {
    if (filtered.length === 0) return;
    for (let offset = 1; offset <= filtered.length; offset++) {
      const next = (activeIndex + step * offset + filtered.length) % filtered.length;
      if (!filtered[next].disabled) {
        setActiveIndex(next);
        return;
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openList();
      else move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  return (
    <div className={`inline-flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <label htmlFor={inputId} className="shrink-0 text-[13px] text-muted">
        {label}
      </label>
      <div
        className="relative min-w-0 flex-1"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
        }}
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 fill-none stroke-muted"
        >
          <circle cx="6" cy="6" r="4.75" strokeWidth="1.5" />
          <path d="M9.5 9.5L13 13" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={open ? query : (selected?.label ?? "")}
          onChange={(event) => {
            if (!open) setOpen(true);
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onClick={openList}
          onKeyDown={onKeyDown}
          className="h-9 w-full min-w-[200px] truncate rounded-full bg-fill pr-9 pl-9 text-[16px] font-medium transition-colors duration-150 outline-none placeholder:text-muted hover:bg-hairline-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-[14px]"
        />
        <svg
          aria-hidden="true"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          className={`pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 fill-none stroke-ink transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="M1 1l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!open}
          className="absolute top-full left-0 z-30 mt-2 max-h-80 w-full min-w-[240px] animate-menu-in overflow-y-auto overscroll-contain rounded-[18px] border border-hairline bg-canvas p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.10)]"
        >
          {filtered.length === 0 && <p className="px-3 py-2 text-[14px] text-muted">No matches</p>}
          {groups.map((group, groupIndex) => {
            const groupLabelId = `${id}-group-${groupIndex}`;
            const items = group.options.map(({ option, index }) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  id={`${id}-option-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => {
                    if (!option.disabled && activeIndex !== index) setActiveIndex(index);
                  }}
                  onClick={() => choose(option)}
                  className={`flex cursor-default items-center gap-2 rounded-[10px] px-3 py-2 text-[14px] ${
                    option.disabled ? "text-muted/50" : "text-ink"
                  } ${index === activeIndex ? "bg-fill" : ""}`}
                >
                  {option.color && (
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {isSelected && (
                    <svg aria-hidden="true" width="12" height="10" viewBox="0 0 12 10" className="shrink-0 fill-none stroke-ink">
                      <path d="M1 5.5L4.25 8.5 11 1.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              );
            });
            if (group.name === undefined) return <Fragment key={`ungrouped-${groupIndex}`}>{items}</Fragment>;
            return (
              <div key={`${group.name}-${groupIndex}`} role="group" aria-labelledby={groupLabelId}>
                <div id={groupLabelId} role="presentation" className="px-3 pt-3 pb-1 text-[12px] text-muted">
                  {group.name}
                </div>
                {items}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
