"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SEGMENT_ITEM_CLASS, SegmentTrack } from "@/components/ui/SegmentedControl";

export function TabLinks(props: { ariaLabel: string; items: { label: string; href: string }[] }) {
  const { ariaLabel, items } = props;
  const pathname = usePathname();
  const activeIndex = items.findIndex((item) => item.href === pathname);

  return (
    <nav aria-label={ariaLabel}>
      <SegmentTrack count={items.length} activeIndex={activeIndex} size="md">
        {items.map((item, index) => {
          const current = index === activeIndex;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`relative z-10 flex items-center justify-center truncate rounded-full font-medium whitespace-nowrap transition-colors duration-150 ${SEGMENT_ITEM_CLASS.md} ${
                current ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </SegmentTrack>
    </nav>
  );
}
