"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { resolveAsk } from "@/lib/ask";
import styles from "./AskBox.module.css";
import { useReducedMotion } from "./useReducedMotion";

const PROMPTS = [
  "Is OSA linked to hypertension?",
  "Which labs change with severe OSA?",
  "Heart failure risk by CPAP use",
  "Compare the eight phenotypes",
  "Medications associated with OSA",
  "Atrial fibrillation by OSA severity",
];

type Phase = "typing" | "holding" | "erasing" | "pausing";

interface Typed {
  index: number;
  length: number;
  phase: Phase;
}

const START_MS = 500;
/** How long each phase lasts before the next step; typing adds ±TYPE_JITTER_MS / 2 per character. */
const PHASE_MS: Record<Phase, number> = { typing: 45, holding: 1800, erasing: 22, pausing: 350 };
const TYPE_JITTER_MS = 30;
const STATIC_SWAP_MS = 3000;

function advance({ index, length, phase }: Typed): Typed {
  switch (phase) {
    case "typing":
      return length < PROMPTS[index].length ? { index, length: length + 1, phase } : { index, length, phase: "holding" };
    case "holding":
      return { index, length, phase: "erasing" };
    case "erasing":
      return length > 0 ? { index, length: length - 1, phase } : { index, length, phase: "pausing" };
    case "pausing":
      return { index: (index + 1) % PROMPTS.length, length: 0, phase: "typing" };
  }
}

/** Types, holds, and erases each prompt in turn while `active`; resumes where it paused. Reduced motion swaps whole prompts. */
function useTypewriter(active: boolean, reduced: boolean): Typed {
  const [typed, setTyped] = useState<Typed>({ index: 0, length: 0, phase: "typing" });
  const typedRef = useRef(typed);

  useEffect(() => {
    if (!active) return;
    const show = (next: Typed) => {
      typedRef.current = next;
      setTyped(next);
    };

    if (reduced) {
      const interval = window.setInterval(() => {
        show({ index: (typedRef.current.index + 1) % PROMPTS.length, length: 0, phase: "typing" });
      }, STATIC_SWAP_MS);
      return () => window.clearInterval(interval);
    }

    const tick = () => {
      const next = advance(typedRef.current);
      show(next);
      const jitter = next.phase === "typing" ? (Math.random() - 0.5) * TYPE_JITTER_MS : 0;
      timer = window.setTimeout(tick, PHASE_MS[next.phase] + jitter);
    };
    let timer = window.setTimeout(tick, START_MS);
    return () => window.clearTimeout(timer);
  }, [active, reduced]);

  return typed;
}

export function AskBox() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [pending, startTransition] = useTransition();
  const empty = value.length === 0;
  const typed = useTypewriter(empty, reduced);
  const prompt = PROMPTS[typed.index];
  const shown = reduced ? prompt : prompt.slice(0, typed.length);
  const query = value.trim();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query || pending) return;
    startTransition(async () => {
      const href = await resolveAsk(query);
      startTransition(() => router.push(href));
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (empty && shown && event.key === "ArrowRight") {
      event.preventDefault();
      setValue(prompt);
    }
  };

  return (
    <form role="search" aria-busy={pending} onSubmit={onSubmit} className="relative mt-8 w-full max-w-[720px] sm:mt-10">
      <input
        type="text"
        aria-label="Ask anything"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        className="h-14 w-full rounded-full border border-hairline bg-white/85 pr-16 pl-5 text-[17px] text-ink shadow-[0_8px_32px_rgb(0_0_0/0.08)] backdrop-blur-xl sm:h-16 sm:pr-[76px] sm:pl-7 sm:text-[19px]"
      />
      {empty && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-16 left-0 flex items-center pl-5 text-[17px] text-muted sm:right-[76px] sm:pl-7 sm:text-[19px]"
        >
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-pre">{shown}</span>
          {!focused && (
            <span
              className={`ml-px h-[1.15em] w-px shrink-0 bg-muted ${typed.phase === "holding" || typed.phase === "pausing" ? styles.blink : ""}`}
            />
          )}
        </div>
      )}
      <button
        type="submit"
        aria-label="Ask"
        disabled={!query}
        className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-white transition-colors duration-150 disabled:bg-hairline sm:right-2.5 sm:size-11"
      >
        {pending ? (
          <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 16V4M5 9l5-5 5 5" />
          </svg>
        )}
      </button>
    </form>
  );
}
