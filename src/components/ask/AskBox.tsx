"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { useReducedMotion } from "@/components/home/useReducedMotion";
import { resolveAsk } from "@/lib/ask/resolve";
import styles from "./AskBox.module.css";

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
/** How long the outline stays red after a refused prompt. */
const REFUSAL_FLASH_MS = 1200;

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

/** Classes that grow the hero box from the small breakpoint up; the dock stays at the base size. */
const LARGE = {
  input: "sm:h-16 sm:pr-[76px] sm:pl-7 sm:text-[19px]",
  prompt: "sm:right-[76px] sm:pl-7 sm:text-[19px]",
  button: "sm:right-2.5 sm:size-11",
};

/** The "Ask anything" box: `className` places the form; `large` is the home page hero size. */
export function AskBox({ className, large = false }: { className: string; large?: boolean }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  /** Refusals since the last edit; the hint shows while any stand. */
  const [refusals, setRefusals] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const [pending, startTransition] = useTransition();
  const empty = value.length === 0;
  const typed = useTypewriter(empty, reduced);
  const prompt = PROMPTS[typed.index];
  const shown = reduced ? prompt : prompt.slice(0, typed.length);
  const query = value.trim();

  // Each refusal restarts the red flash.
  useEffect(() => {
    if (!flashing) return;
    const timer = setTimeout(() => setFlashing(false), REFUSAL_FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashing, refusals]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query || pending) return;
    startTransition(async () => {
      const href = await resolveAsk(query);
      // Clearing inside the transition commits together with the navigation.
      startTransition(() => {
        if (href === null) {
          setRefusals((n) => n + 1);
          setFlashing(true);
          return;
        }
        router.push(href);
        setValue("");
        setRefusals(0);
      });
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (empty && shown && event.key === "ArrowRight") {
      event.preventDefault();
      setValue(prompt);
    }
  };

  return (
    <form role="search" aria-busy={pending} onSubmit={onSubmit} className={`relative w-full ${className}`}>
      <input
        type="text"
        aria-label="Ask anything"
        aria-invalid={refusals > 0}
        aria-describedby={hintId}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setRefusals(0);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        className={`h-14 w-full rounded-full border bg-white/85 pr-16 pl-5 text-[17px] text-ink shadow-[0_8px_32px_rgb(0_0_0/0.08)] backdrop-blur-xl transition-[border-color,box-shadow] duration-300 ease-apple ${flashing ? "border-error ring-1 ring-error" : "border-hairline"} ${large ? LARGE.input : ""}`}
      />
      <p
        id={hintId}
        role="status"
        className={`pointer-events-none absolute inset-x-0 flex justify-center ${large ? "top-full mt-3" : "bottom-full mb-2"}`}
      >
        {refusals > 0 && <span className="rounded-full bg-white/85 px-3 py-1 text-[12px] text-error backdrop-blur-xl">Try another prompt</span>}
      </p>
      {empty && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-16 left-0 flex items-center pl-5 text-[17px] text-muted ${large ? LARGE.prompt : ""}`}
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
        className={`absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-white transition-colors duration-150 disabled:bg-hairline ${large ? LARGE.button : ""}`}
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
