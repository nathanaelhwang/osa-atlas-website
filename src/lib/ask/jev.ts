import "server-only";

/** Client for Jev (TypeSafe's decision model) on OpenRouter's Decisions API, which is still marked alpha. */

const ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
/** Pinned: thresholds in router.ts are tuned against this release; `~typesafe/jev-latest` can move under them. */
const MODEL = "typesafe/jev-1.13";
const TIMEOUT_MS = 2500;

export type Question =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "noul"; instructions: string; criteria: { true: string; false: string } };

/** Choice answers carry the full distribution; noul answers carry P(yes). */
export type Answer = { type: "choice"; probabilities: Record<string, number> } | { type: "noul"; noul: number };

export interface Decisions {
  answers: Record<string, Answer>;
  /** USD, as reported by OpenRouter. */
  cost: number;
}

export type Decide = (state: Record<string, unknown>, questions: Record<string, Question>) => Promise<Decisions>;

function parseAnswer(value: unknown): Answer | null {
  if (typeof value !== "object" || value === null || !("type" in value)) return null;
  if (value.type === "noul" && "noul" in value && typeof value.noul === "number") return { type: "noul", noul: value.noul };
  if (value.type !== "choice" || !("choice" in value) || typeof value.choice !== "string") return null;
  const probabilities: Record<string, number> = {};
  if ("probabilities" in value && typeof value.probabilities === "object" && value.probabilities !== null) {
    for (const [option, p] of Object.entries(value.probabilities)) if (typeof p === "number") probabilities[option] = p;
  }
  // `probabilities` is optional in the schema; without it, all mass sits on the chosen option.
  if (Object.keys(probabilities).length === 0) probabilities[value.choice] = 1;
  return { type: "choice", probabilities };
}

export const decide: Decide = async (state, questions) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, state, questions }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Jev request failed: HTTP ${response.status} ${await response.text()}`);

  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("answers" in body) || typeof body.answers !== "object" || body.answers === null) {
    throw new Error("Jev response has no answers");
  }
  const answers: Record<string, Answer> = {};
  for (const id of Object.keys(questions)) {
    const answer = parseAnswer((body.answers as Record<string, unknown>)[id]);
    if (!answer) throw new Error(`Jev response lacks a valid answer for "${id}"`);
    answers[id] = answer;
  }
  const usage = "usage" in body && typeof body.usage === "object" && body.usage !== null ? body.usage : null;
  const cost = usage !== null && "cost" in usage && typeof usage.cost === "number" ? usage.cost : 0;
  return { answers, cost };
};
