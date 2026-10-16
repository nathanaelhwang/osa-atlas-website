import { getAskCatalog } from "@/lib/ask/catalog";
import { decide } from "@/lib/ask/jev";
import { createRetriever, type Retrieve } from "@/lib/ask/retrieve";
import { routePrompt } from "@/lib/ask/router";

/** Two Jev rounds at most, each capped at 2.5 s in jev.ts. */
export const maxDuration = 10;

const MAX_PROMPT_LENGTH = 500;

let retrieve: Retrieve | null = null;

/**
 * POST { prompt } → { href }: a site path for the "Ask anything" box, or null when the prompt is clearly unrelated to
 * the atlas. Any Jev failure answers 503 so the client falls back to its keyword router, which never refuses. Rate
 * limiting is a Vercel firewall rule on this path (see README).
 */
export async function POST(request: Request): Promise<Response> {
  let prompt: unknown;
  try {
    const body: unknown = await request.json();
    prompt = typeof body === "object" && body !== null && "prompt" in body ? body.prompt : undefined;
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (typeof prompt !== "string" || prompt.trim() === "" || prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json({ error: `prompt must be 1–${MAX_PROMPT_LENGTH} characters` }, { status: 400 });
  }

  try {
    const catalog = getAskCatalog();
    retrieve ??= createRetriever(catalog.entities);
    const { href } = await routePrompt(prompt.trim(), { catalog, decide, retrieve });
    return Response.json({ href });
  } catch (error) {
    console.error("/api/ask: Jev routing failed", error);
    return Response.json({ error: "Routing unavailable" }, { status: 503 });
  }
}
