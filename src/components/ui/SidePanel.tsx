"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode, type Ref } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function CloseButton({ onClose, ref }: { onClose: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Close"
      onClick={onClose}
      className="flex size-7 items-center justify-center rounded-full bg-fill transition-colors duration-150 hover:bg-hairline-soft"
    >
      <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className="stroke-muted">
        <path d="M1 1l8 8M9 1L1 9" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function SidePanel(props: { open: boolean; onClose: () => void; children: ReactNode; ariaLabel: string }) {
  const { open, onClose, children, ariaLabel } = props;
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
  const sheetCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Bottom sheet is modal: lock page scroll and move focus into it.
  useEffect(() => {
    if (!open || isDesktop) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isDesktop]);

  if (isDesktop) {
    return (
      <aside
        aria-label={ariaLabel}
        inert={!open}
        className="shrink-0 self-stretch overflow-clip transition-[width] duration-[240ms] ease-apple"
        style={{ width: open ? 360 : 0 }}
      >
        <div className="sticky top-12 flex max-h-[calc(100vh-3rem)] w-[360px] flex-col overflow-y-auto border-l border-hairline bg-canvas">
          <div className="sticky top-0 z-10 flex justify-end bg-canvas p-3 pb-0">
            <CloseButton onClose={onClose} />
          </div>
          <div className="px-6 pb-8">{children}</div>
        </div>
      </aside>
    );
  }

  return (
    <div inert={!open}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/25 transition-opacity duration-[240ms] ease-apple ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`fixed inset-x-0 bottom-0 z-[70] flex max-h-[80vh] flex-col overflow-y-auto rounded-t-[18px] bg-canvas transition-transform duration-[240ms] ease-apple ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-end bg-canvas p-3 pb-0">
          <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-hairline" />
          <CloseButton onClose={onClose} ref={sheetCloseRef} />
        </div>
        <div className="px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
