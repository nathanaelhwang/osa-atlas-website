"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { NAV, type NavItem } from "@/lib/site";

const HOVER_CLOSE_DELAY_MS = 120;

function isSectionActive(item: NavItem, pathname: string): boolean {
  const section = `/${item.href.split("/")[1]}`;
  return pathname === section || pathname.startsWith(`${section}/`);
}

function focusMenuLink(menu: HTMLElement | null | undefined, which: "first" | "last") {
  const links = menu?.querySelectorAll<HTMLAnchorElement>("a");
  if (links && links.length > 0) links[which === "first" ? 0 : links.length - 1].focus();
}

export function SiteNav() {
  const pathname = usePathname();
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [renderedPath, setRenderedPath] = useState(pathname);
  const navRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuRefs = useRef<(HTMLUListElement | null)[]>([]);
  const pendingFocus = useRef<"first" | "last" | null>(null);
  const closeTimer = useRef<number | null>(null);
  const lastPointerType = useRef("mouse");

  // Close every menu when the route changes (adjusting state during render, not in an effect).
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setOpenIndex(null);
    setMobileOpen(false);
  }

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  useEffect(() => {
    const timer = closeTimer;
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  // Move focus into a menu opened from the keyboard.
  useEffect(() => {
    if (openIndex === null || pendingFocus.current === null) return;
    focusMenuLink(menuRefs.current[openIndex], pendingFocus.current);
    pendingFocus.current = null;
  }, [openIndex]);

  // Click outside and Escape close the desktop menu.
  useEffect(() => {
    if (openIndex === null) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenIndex(null);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (navRef.current?.contains(document.activeElement)) buttonRefs.current[openIndex]?.focus();
      setOpenIndex(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openIndex]);

  // Mobile sheet: lock page scroll, Escape closes, widening past md closes.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onChange);
    };
  }, [mobileOpen]);

  const onItemPointerEnter = (index: number, event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    setOpenIndex(index);
  };

  const onItemPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenIndex(null), HOVER_CLOSE_DELAY_MS);
  };

  const onButtonKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const which = event.key === "ArrowDown" ? "first" : "last";
    if (openIndex === index) {
      focusMenuLink(menuRefs.current[index], which);
    } else {
      pendingFocus.current = which;
      setOpenIndex(index);
    }
  };

  const onButtonClick = (index: number, detail: number) => {
    if (detail === 0) {
      // Enter, Space, or assistive technology: toggle and move focus into the menu.
      if (openIndex === index) {
        setOpenIndex(null);
      } else {
        pendingFocus.current = "first";
        setOpenIndex(index);
      }
    } else if (lastPointerType.current === "mouse") {
      cancelClose();
      setOpenIndex(index);
    } else {
      setOpenIndex((current) => (current === index ? null : index));
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (current + 1) % links.length;
    else if (event.key === "ArrowUp") next = current <= 0 ? links.length - 1 : current - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = links.length - 1;
    if (next === null) return;
    event.preventDefault();
    links[next].focus();
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 h-12 border-b border-hairline ${
          mobileOpen ? "bg-canvas" : "bg-canvas/80 backdrop-blur-xl backdrop-saturate-150"
        }`}
      >
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="rounded-md text-[17px] font-semibold tracking-[-0.022em]">
            OSA Atlas
          </Link>

          <nav
            ref={navRef}
            aria-label="Main"
            className="hidden md:block"
          >
            <ul className="flex items-center gap-1">
              {NAV.map((item, index) => {
                const open = openIndex === index;
                const active = isSectionActive(item, pathname);
                const menuId = `${baseId}-menu-${index}`;
                return (
                  <li
                    key={item.label}
                    className="relative"
                    onPointerEnter={(event) => onItemPointerEnter(index, event)}
                    onPointerLeave={onItemPointerLeave}
                    onBlur={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                      setOpenIndex((current) => (current === index ? null : current));
                    }}
                  >
                    <button
                      ref={(node) => {
                        buttonRefs.current[index] = node;
                      }}
                      type="button"
                      aria-expanded={open}
                      aria-controls={menuId}
                      onPointerDown={(event) => {
                        lastPointerType.current = event.pointerType;
                      }}
                      onClick={(event) => onButtonClick(index, event.detail)}
                      onKeyDown={(event) => onButtonKeyDown(index, event)}
                      className={`flex h-11 items-center rounded-md px-3 text-[14px] transition-colors duration-150 ${
                        active || open ? "text-ink" : "text-muted hover:text-ink"
                      }`}
                    >
                      {item.label}
                    </button>
                    <ul
                      ref={(node) => {
                        menuRefs.current[index] = node;
                      }}
                      id={menuId}
                      hidden={!open}
                      onKeyDown={onMenuKeyDown}
                      className={`absolute top-[calc(100%-4px)] min-w-[200px] animate-menu-in rounded-[18px] border border-hairline bg-canvas p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.10)] ${
                        index === NAV.length - 1 ? "right-0" : "left-0"
                      }`}
                    >
                      {item.children.map((child) => {
                        const current = pathname === child.href;
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              aria-current={current ? "page" : undefined}
                              onClick={() => setOpenIndex(null)}
                              className={`block rounded-[10px] px-3 py-2 text-[14px] transition-colors duration-150 hover:bg-fill ${
                                current ? "font-medium text-ink" : "text-ink/80"
                              }`}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            aria-controls={`${baseId}-sheet`}
            onClick={() => setMobileOpen((current) => !current)}
            className="-mr-2 flex size-10 items-center justify-center rounded-full md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="stroke-ink">
              {mobileOpen ? (
                <path d="M4 4l10 10M14 4L4 14" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M2.5 6.5h13M2.5 11.5h13" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </header>

      <div
        id={`${baseId}-sheet`}
        hidden={!mobileOpen}
        className="fixed inset-x-0 top-12 bottom-0 z-40 animate-fade-in overflow-y-auto bg-canvas md:hidden"
      >
        <nav aria-label="Main" className="px-6 pt-6 pb-12">
          <ul className="flex flex-col gap-8">
            {NAV.map((item) => (
              <li key={item.label}>
                <p className="text-[21px] font-semibold tracking-[-0.02em]">{item.label}</p>
                <ul className="mt-2 flex flex-col">
                  {item.children.map((child) => {
                    const current = pathname === child.href;
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={current ? "page" : undefined}
                          onClick={() => setMobileOpen(false)}
                          className={`block py-2 text-[17px] ${current ? "font-medium text-ink" : "text-muted"}`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
