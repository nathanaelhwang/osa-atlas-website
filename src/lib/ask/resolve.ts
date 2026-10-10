import { buildKeywordIndex, keywordHref, type KeywordIndex } from "@/lib/ask/keyword";
import type { FeatureRegistry, SurvivalManifest } from "@/lib/ask/sources";
import { fetchJson } from "@/lib/data/client";

/** Client budget for /api/ask; past it the keyword router answers instead. */
const ASK_TIMEOUT_MS = 6000;

let indexPromise: Promise<KeywordIndex> | null = null;

function loadIndex(): Promise<KeywordIndex> {
  if (!indexPromise) {
    indexPromise = Promise.all([
      fetchJson<FeatureRegistry>("features.json"),
      fetchJson<SurvivalManifest>("survival-manifest.json"),
    ]).then(([registry, survival]) => buildKeywordIndex(registry, survival));
    indexPromise.catch(() => {
      indexPromise = null;
    });
  }
  return indexPromise;
}

/**
 * Turns a free-text prompt into a site path. The Jev router at /api/ask answers first; any failure (firewall 429,
 * Jev outage, timeout, network) falls back to the keyword router.
 */
export async function resolveAsk(prompt: string): Promise<string> {
  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(ASK_TIMEOUT_MS),
    });
    if (response.ok) {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "href" in body &&
        typeof body.href === "string" &&
        body.href.startsWith("/") &&
        !body.href.startsWith("//")
      ) {
        return body.href;
      }
    }
  } catch {
    // Network failure or timeout: the keyword router answers below.
  }
  return keywordHref(prompt, loadIndex);
}
