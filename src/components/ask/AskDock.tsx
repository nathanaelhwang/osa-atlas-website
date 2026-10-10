"use client";

import { usePathname } from "next/navigation";
import { AskBox } from "./AskBox";
import styles from "./AskDock.module.css";

/** The ask box floating at the bottom of every page except home, which has its own. */
export function AskDock() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div className={styles.dock}>
      <AskBox className="pointer-events-auto max-w-[560px]" />
    </div>
  );
}
