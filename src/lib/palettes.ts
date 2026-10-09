// Data colors sampled from the manuscript figure legends (modal swatch pixel).
// Keys are the exact `category` strings in the data (`subgroup` for utilwas_specialty).

export type PaletteKey = "phecode" | "labwas" | "medwas" | "procwas" | "utilwas_specialty" | "qwas" | "behwas";

export interface CategoryPalette {
  order: string[];
  colors: Record<string, string>;
  labels: Record<string, string>;
}

type PaletteEntry = readonly [category: string, label: string, color: string];

function buildPalette(entries: readonly PaletteEntry[]): CategoryPalette {
  const palette: CategoryPalette = { order: [], colors: {}, labels: {} };
  for (const [category, label, color] of entries) {
    palette.order.push(category);
    palette.colors[category] = color;
    palette.labels[category] = label;
  }
  return palette;
}

const FALLBACK_COLOR = "#939393";

export const CATEGORY_PALETTES: Record<PaletteKey, CategoryPalette> = {
  // Figure 1 (PheDAS prevalence) legend; identical legend in Figure 5 (UtilWAS diagnosis panels).
  phecode: buildPalette([
    ["infectious diseases", "Infectious diseases", "#4e79a7"],
    ["neoplasms", "Neoplasms", "#a44386"],
    ["endocrine/metabolic", "Endocrine/metabolic", "#e08718"],
    ["hematopoietic", "Hematopoietic", "#aa3939"],
    ["mental disorders", "Mental disorders", "#8064a2"],
    ["neurological", "Neurological", "#4a548f"],
    ["sense organs", "Sense organs", "#8a6e44"],
    ["circulatory system", "Circulatory system", "#d1495b"],
    ["respiratory", "Respiratory", "#1c8b9d"],
    ["digestive", "Digestive", "#4f8a47"],
    ["genitourinary", "Genitourinary", "#8660a8"],
    ["pregnancy complications", "Pregnancy complications", "#cc79a7"],
    ["dermatologic", "Dermatologic", "#a97525"],
    ["musculoskeletal", "Musculoskeletal", "#527e7f"],
    ["congenital anomalies", "Congenital anomalies", "#7a8450"],
    ["symptoms", "Symptoms", "#555555"],
    ["injuries & poisonings", "Injuries & poisonings", "#b55b31"],
    ["other", "Other", "#939393"],
  ]),
  // Figures 2A/2B/2C (LabWAS) legend. The manuscript reuses colors across non-adjacent entries:
  // allergy = infectious, blood = metabolic, immune = ob/gyn, nutrition/vitamins = toxicology/pharmacology.
  labwas: buildPalette([
    ["endocrine", "Endocrine", "#e08718"],
    ["cardiovascular", "Cardiovascular", "#d1495b"],
    ["other", "Other", "#939393"],
    ["allergy", "Allergy", "#a86f9b"],
    ["blood", "Blood", "#2b5d57"],
    ["cancer", "Cancer", "#7770b3"],
    ["coagulation", "Coagulation", "#7a4f36"],
    ["immune", "Immune", "#799e3a"],
    ["infectious", "Infectious", "#a86f9b"],
    ["kidney", "Kidney", "#3c97c7"],
    ["liver", "Liver", "#ac5016"],
    ["metabolic", "Metabolic", "#2b5d57"],
    ["nutrition/vitamins", "Nutrition/vitamins", "#14786c"],
    ["ob/gyn", "Ob/gyn", "#799e3a"],
    ["toxicology/pharmacology", "Toxicology/pharmacology", "#14786c"],
    ["urinary", "Urinary", "#b74e73"],
  ]),
  // Figure 3 (MedWAS) legend.
  medwas: buildPalette([
    ["ANTI-INFECTIVE AGENTS", "Anti-infective agents", "#4e79a7"],
    ["ANTINEOPLASTIC AGENTS", "Antineoplastic agents", "#a44386"],
    ["ENDOCRINE & METABOLIC", "Endocrine & metabolic", "#e08718"],
    ["HEMATOLOGICAL", "Hematological", "#aa3939"],
    ["CNS", "CNS", "#4a548f"],
    ["CARDIOVASCULAR", "Cardiovascular", "#d1495b"],
    ["RESPIRATORY", "Respiratory", "#1c8b9d"],
    ["GASTROINTESTINAL", "Gastrointestinal", "#4f8a47"],
    ["GENITOURINARY", "Genitourinary", "#8660a8"],
    ["MISCELLANEOUS", "Miscellaneous", "#939393"],
    ["ANALGESICS & ANESTHETICS", "Analgesics & anesthetics", "#a86f9b"],
    ["BIOLOGICALS", "Biologicals", "#526d38"],
    ["MISC PSYCH/NEURO", "Misc psych/neuro", "#7a4f36"],
    ["NEUROMUSCULAR", "Neuromuscular", "#14786c"],
    ["NUTRITIONAL", "Nutritional", "#799e3a"],
    ["STIMULANTS/ANTI-OBESITY", "Stimulants/anti-obesity", "#7770b3"],
    ["TOPICAL", "Topical", "#c76d43"],
  ]),
  // Figure 4 (ProcWAS) legend.
  procwas: buildPalette([
    ["Endocrine", "Endocrine", "#e08718"],
    ["Nervous system", "Nervous system", "#4a548f"],
    ["Eye / Ophthalmic", "Eye / ophthalmic", "#8a6e44"],
    ["Cardiovascular / Lymphatic", "Cardiovascular / lymphatic", "#d1495b"],
    ["Respiratory", "Respiratory", "#1c8b9d"],
    ["Digestive", "Digestive", "#4f8a47"],
    ["Urinary / Renal", "Urinary / renal", "#8660a8"],
    ["Maternity / Obstetric", "Maternity / obstetric", "#cc79a7"],
    ["Integumentary / Skin", "Integumentary / skin", "#a97525"],
    ["Musculoskeletal", "Musculoskeletal", "#527e7f"],
    ["General / Not system-specific", "General / not system-specific", "#939393"],
    ["Female reproductive", "Female reproductive", "#b74e73"],
  ]),
  // Figure 5D/5E (UtilWAS specialty encounters) group headings: physician specialties, allied-health specialties.
  utilwas_specialty: buildPalette([
    ["Physician-level care", "Physician-level care", "#3c97c7"],
    ["Allied health", "Allied health", "#526d38"],
  ]),
  // Figure 6A/6B (QWAS binary and continuous) legends; both legends share colors.
  qwas: buildPalette([
    ["Chief complaint", "Chief complaint", "#a64c14"],
    ["Function", "Function", "#347645"],
    ["Insomnia", "Insomnia", "#65519b"],
    ["Mood", "Mood", "#c04468"],
    ["OSA symptoms", "OSA symptoms", "#8c5a32"],
    ["Parasomnia", "Parasomnia", "#338a96"],
    ["Restless legs", "Restless legs", "#727a26"],
    ["Sleep habits", "Sleep habits", "#cd741c"],
    ["Sleepiness", "Sleepiness", "#a38700"],
    ["Somatic", "Somatic", "#4674a6"],
  ]),
  // Figure 7 (BehWAS) domain headings: Attendance, Medication adherence, Vaccination, Work leave (off-work orders).
  behwas: buildPalette([
    ["Appointment attendance", "Appointment attendance", "#ac5016"],
    ["Medication adherence", "Medication adherence", "#a89720"],
    ["Preventive care", "Preventive care", "#799e3a"],
    // Not in the manuscript legend (FMLA outcomes are not shown in Figure 7).
    ["Leave and work absence", "Leave and work absence", "#4e79a7"],
    ["Work status", "Work status", "#a86f9b"],
  ]),
};

export function categoryColor(palette: PaletteKey, category: string): string {
  return CATEGORY_PALETTES[palette].colors[category] ?? FALLBACK_COLOR;
}

export function categoryLabel(palette: PaletteKey, category: string): string {
  return CATEGORY_PALETTES[palette].labels[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

export function categoryOrder(palette: PaletteKey, present: Iterable<string>): string[] {
  const remaining = new Set(present);
  const ordered = CATEGORY_PALETTES[palette].order.filter((category) => remaining.delete(category));
  return ordered.concat([...remaining].sort((a, b) => a.localeCompare(b)));
}

// Figure 9A legend (cumulative incidence by OSA severity).
export const SEVERITY_COLORS: Record<"No OSA" | "Mild" | "Moderate" | "Severe", string> = {
  "No OSA": "#4d4d4d",
  Mild: "#e69f00",
  Moderate: "#d55e00",
  Severe: "#b2182b",
};

// Figure 9B legend (cumulative incidence by PAP use); "unknown" is drawn dotted.
export const CPAP_COLORS: Record<string, string> = {
  "4+ hr/night": "#2166ac",
  "2-4 hr/night": "#67a9cf",
  "0-2 hr/night": "#ef8a62",
  "never-started": "#b2182b",
  unknown: "#888888",
};

// Figure 11 focal-phenotype headings give high-all, symptom-predominant, and symptomatic-comorbid.
export const OCTANT_COLORS: Record<string, string> = {
  // Not in the manuscript legend.
  "mild-all": "#9c8a5a",
  // Not in the manuscript legend.
  "hypoxemia-predominant": "#d0782f",
  "symptom-predominant": "#2879a1",
  // Not in the manuscript legend.
  "comorbidity-predominant": "#4f8a47",
  // Not in the manuscript legend.
  "hypoxemic-symptomatic": "#c2577f",
  // Not in the manuscript legend.
  "hypoxemic-comorbid": "#2f8f83",
  "symptomatic-comorbid": "#7b5698",
  "high-all": "#a33e3e",
};

// Figure 12 No OSA reference curve (blue dotted).
export const NO_OSA_COLOR = "#0072b2";
