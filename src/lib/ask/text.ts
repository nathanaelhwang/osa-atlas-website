/** Text matching shared by the keyword fallback and the candidate retriever. */

export const MIN_TERM_LENGTH = 4;

/** Trailing PheCode qualifiers that users never type. */
export const QUALIFIER = / (nos|nec|unspecified)$/;
const BRACKETED = /\[([^\]]+)\]/g;
/** Bracketed or parenthesized asides in feature names. */
export const DECORATION = /\s*(\[[^\]]*\]|\([^)]*\))/g;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Whole-word containment; `text` must be normalized and padded with single spaces. */
export function mentions(text: string, phrase: string): boolean {
  return text.includes(` ${phrase} `);
}

/** Matchable forms of a feature name: as written, without decorations or qualifiers, and bracketed synonyms. */
export function nameForms(name: string): string[] {
  const forms = [name, name.replace(DECORATION, " "), ...Array.from(name.matchAll(BRACKETED), (m) => m[1])];
  return forms.flatMap((form) => {
    const text = normalize(form);
    return [text, text.replace(QUALIFIER, "")];
  });
}

/** PheCodes in one lineage: one is the other refined by more digits (401 → 401.1, 427.2 → 427.21). */
export function sameLineage(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.startsWith(short) && (short.includes(".") || long[short.length] === ".");
}
