import type { Entity } from "@/lib/ask/catalog";
import { mentions, normalize } from "@/lib/ask/text";

/**
 * Candidate retrieval: ranks entities whose names share words with the prompt, so Jev chooses among a short list
 * instead of the whole registry. Exact names rank first; partial overlaps are weighted by word rarity.
 */

export type Retrieve = (prompt: string) => Entity[];

const CANDIDATE_LIMIT = 20;
/** Share of an entity name's word weight the prompt must cover to be a candidate. */
const MIN_COVERAGE = 0.3;
const PHECODE = /\b\d{3}(?:\.\d{1,2})?\b/g;

/** Words that carry no feature identity on this site (OSA is the exposure on every page). */
const STOPWORDS: Record<string, true> = Object.fromEntries(
  (
    "a an the and or of in on at for with without to by from as is are was were be been do does did how what which " +
    "who why when where show me my see view plot plots chart look data result results association associations " +
    "associated link linked between vs versus osa ahi apnea apneas hypopnea patient patients people adult adults " +
    "among than more less any other nos unspecified their they them it its this that there about after before over " +
    "time risk risks rate rates level levels"
  )
    .split(" ")
    .map((word) => [word, true]),
);

function words(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((word) => word !== "" && !STOPWORDS[word])
    .map((word) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word));
}

interface FormEntry {
  entity: Entity;
  /** Normalized form, for whole-phrase matching. */
  form: string;
  words: string[];
}

export function createRetriever(entities: Entity[]): Retrieve {
  const entries: FormEntry[] = entities.flatMap((entity) =>
    entity.forms.map((form) => ({ entity, form, words: [...new Set(words(form))] })).filter((entry) => entry.words.length > 0),
  );

  const documentFrequency = new Map<string, number>();
  for (const entity of entities) {
    for (const word of new Set(entity.forms.flatMap(words))) {
      documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
    }
  }
  const weight = (word: string) => Math.log(1 + entities.length / (documentFrequency.get(word) ?? 1));

  const byWord = new Map<string, FormEntry[]>();
  for (const entry of entries) {
    for (const word of entry.words) {
      if (!byWord.has(word)) byWord.set(word, []);
      byWord.get(word)?.push(entry);
    }
  }
  const diseasesById = new Map(entities.filter((e) => e.kind === "disease").map((e) => [e.id, e]));

  return (prompt) => {
    const text = ` ${normalize(prompt)} `;
    const promptWords = new Set(words(prompt));
    const scores = new Map<Entity, number>();
    const seen = new Set<FormEntry>();

    for (const word of promptWords) {
      for (const entry of byWord.get(word) ?? []) {
        if (seen.has(entry)) continue;
        seen.add(entry);
        let matched = 0;
        let total = 0;
        for (const w of entry.words) {
          total += weight(w);
          if (promptWords.has(w)) matched += weight(w);
        }
        if (matched / total < MIN_COVERAGE) continue;
        // matched² / total rewards both covering the name and matching rare words; whole phrases rank first.
        const score = (matched * matched) / total + (mentions(text, entry.form) ? 100 : 0);
        if (score > (scores.get(entry.entity) ?? 0)) scores.set(entry.entity, score);
      }
    }
    for (const code of prompt.match(PHECODE) ?? []) {
      const entity = diseasesById.get(code);
      if (entity) scores.set(entity, (scores.get(entity) ?? 0) + 1000);
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, CANDIDATE_LIMIT)
      .map(([entity]) => entity);
  };
}
