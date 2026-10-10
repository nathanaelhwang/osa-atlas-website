import "server-only";

import type { Catalog, CodePage, Entity, EntityKind, PageId, WasFamily } from "@/lib/ask/catalog";
import { buildHref, type Plan } from "@/lib/ask/href";
import type { Answer, Decide, Question } from "@/lib/ask/jev";
import type { Retrieve } from "@/lib/ask/retrieve";
import { CONTRAST_LABELS, MODEL_LABELS } from "@/lib/data/labels";
import { categoryLabel } from "@/lib/palettes";

/**
 * Jev router. Round 1 asks every question in parallel: the page, the settings, whether a feature is named, and which
 * retrieved candidate it is. Round 2 (only when no candidate fits) walks the destination's feature tree:
 * body system → feature for large pools, or the whole pool when it fits one Choice (≤255 options).
 */

export interface AskDeps {
  catalog: Catalog;
  decide: Decide;
  retrieve: Retrieve;
}

export interface AskResult {
  href: string;
  rounds: number;
  /** USD across rounds. */
  cost: number;
}

/** Tuned on scripts/ask-eval.jsonl; see README "Ask box". */
const THRESHOLDS = {
  /** Minimum probability for a setting answer to leave the page default. */
  setting: 0.65,
  /** Minimum P(yes) for a yes/no question. */
  yes: 0.5,
  /** Minimum probability for a retrieved candidate to skip the feature tree. */
  candidate: 0.6,
};
/** Body systems explored in parallel in the feature tree. */
const TREE_BEAM = 3;
const MAX_OPTIONS = 255;

const NOT_SPECIFIED = "not_specified";
const NONE = "none_of_these";

const PAGES: Record<string, { page: PageId; description: string }> = {
  disease_prevalence: {
    page: "phedas-prevalence",
    description:
      "Diseases more or less common in people with OSA at the sleep study (cross-sectional disease associations, PheDAS prevalence). The usual page when a disease is named with no time, curve, CPAP or phenotype cue.",
  },
  disease_incidence: {
    page: "phedas-incidence",
    description:
      "Risk of developing new diseases after the sleep study (incident disease hazard ratios, PheDAS incidence), including comparisons between severity groups, dose-response trends and any difference across severity groups.",
  },
  labs: { page: "labwas", description: "Lab tests: lab values and how often labs are ordered (LabWAS)." },
  medications: { page: "medwas", description: "Medication classes filled or prescribed, including drug names (MedWAS)." },
  questionnaire: {
    page: "qwas",
    description: "Sleep clinic intake questionnaire answers and chief complaints at the sleep study (QWAS).",
  },
  procedures: { page: "procwas", description: "Medical procedures and tests performed (ProcWAS)." },
  healthcare_use: {
    page: "utilwas",
    description:
      "Healthcare use: diagnoses recorded at emergency, urgent care, inpatient and physician visits, and visits to medical specialties (UtilWAS).",
  },
  behaviors: {
    page: "behwas",
    description: "Health behaviors recorded in the medical record (BehWAS).",
  },
  phenotype_profiles: {
    page: "profiles",
    description:
      "The 8 OSA phenotypes (octants by hypoxemia, symptoms and comorbidity): who is in each phenotype and how they differ. Not for disease risk.",
  },
  phenotype_outcomes: {
    page: "outcomes",
    description: "How the risk of a disease or outcome differs across the 8 OSA phenotypes, subtypes or clusters.",
  },
  curves_by_severity: {
    page: "curves-severity",
    description:
      "Plotted cumulative incidence curves of one disease over follow-up years by OSA severity group. Only when the request asks for curves, plots over time or cumulative incidence.",
  },
  curves_by_cpap: {
    page: "curves-cpap",
    description: "Cumulative incidence curves of one disease by CPAP adherence or CPAP use; any request about CPAP and a disease.",
  },
};

const KIND_LABELS: Record<EntityKind, string> = {
  disease: "Disease",
  lab: "Lab test",
  medication: "Medication class",
  questionnaire: "Questionnaire item",
  procedure: "Procedure",
  specialty: "Specialty visits",
  behavior: "Behavior",
};

const MEASURES: Record<string, { description: string; analyses: string[] }> = {
  lab_mean: { description: "Mean lab value", analyses: ["labwas_mean"] },
  lab_median: { description: "Median lab value", analyses: ["labwas_median"] },
  lab_order_rate: { description: "How often a lab test is ordered", analyses: ["labwas_order_rate"] },
  lab_any_order: { description: "Whether a lab test was ever ordered", analyses: ["labwas_order_propensity"] },
  diagnosis_presence: { description: "Whether a diagnosis is recorded at visits in a care setting", analyses: ["utilwas_presence"] },
  specialty_visits: { description: "Visits to a medical specialty", analyses: ["utilwas_specialty_rate"] },
  binary: { description: "Yes or no answers", analyses: ["qwas_binary", "behwas_binary"] },
  continuous: { description: "Scores, amounts or other continuous values", analyses: ["qwas_continuous", "behwas_continuous"] },
};

const MODEL_DESCRIPTIONS: Record<string, string> = {
  M1: "Unadjusted, crude",
  M2: "Adjusted for demographics",
  M3: "Adjusted for demographics, smoking and neighborhood income",
  M4: "Fully adjusted, including BMI",
};

const CONTRAST_DESCRIPTIONS: Record<string, string> = {
  ahi_ge5: "Any OSA: AHI 5 or more vs under 5",
  ahi_ge15: "Moderate to severe OSA: AHI 15 or more vs under 15",
  mild_vs_none: "Mild OSA vs no OSA",
  moderate_vs_none: "Moderate OSA vs no OSA",
  severe_vs_none: "Severe OSA (AHI 30 or more) vs no OSA",
  trend: "Dose-response trend across severity groups",
  omnibus: "Any difference across severity groups (joint test)",
};

const FAMILY_CATEGORY_TOPICS: Record<Exclude<WasFamily, "utilwas">, string> = {
  labwas: "lab tests",
  medwas: "medications",
  qwas: "questionnaire items",
  procwas: "procedures",
  behwas: "behaviors",
};

function choice(instructions: string, options: Record<string, string>, notSpecified?: string): Question {
  return {
    type: "choice",
    instructions,
    criteria: notSpecified === undefined ? options : { ...options, [NOT_SPECIFIED]: notSpecified },
  };
}

/** Choice over entities; option names are entity names (made unique), mapped back through `byKey`. */
function entityChoice(entities: Entity[]): { question: Question; byKey: Map<string, Entity> } {
  if (entities.length + 1 > MAX_OPTIONS) throw new Error(`Choice over ${entities.length} entities exceeds ${MAX_OPTIONS} options`);
  const byKey = new Map<string, Entity>();
  const criteria: Record<string, string> = {};
  for (const entity of entities) {
    let key = entity.name;
    if (byKey.has(key)) key = `${entity.name} (${KIND_LABELS[entity.kind]})`;
    if (byKey.has(key)) key = `${key} ${entity.id}`;
    byKey.set(key, entity);
    const also = entity.alternates.length > 0 ? `; also called ${entity.alternates.slice(0, 3).join(", ")}` : "";
    criteria[key] = `${KIND_LABELS[entity.kind]}, ${entity.category}${also}`;
  }
  criteria[NONE] = "None of these is what the request asks about";
  return {
    question: {
      type: "choice",
      instructions: "Which item is `request` asking about? OSA itself is the exposure on every page, never the item.",
      criteria,
    },
    byKey,
  };
}

function distribution(answer: Answer | undefined): [string, number][] {
  return answer?.type === "choice" ? Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]) : [];
}

/** Answer of a settings question, or null when it is unspecified or below the threshold. */
function specified(answer: Answer | undefined): string | null {
  const [top] = distribution(answer);
  return top && top[0] !== NOT_SPECIFIED && top[1] >= THRESHOLDS.setting ? top[0] : null;
}

/** What each page contains, from the data, appended to its description in the page question. */
function pageCoverage(catalog: Catalog, page: PageId): string {
  switch (page) {
    case "labwas":
    case "medwas":
    case "procwas":
      return ` Topics: ${catalog.familyCategories[page].map((c) => categoryLabel(page, c)).join(", ")}.`;
    case "qwas":
    case "behwas":
      // Small, idiosyncratic item lists: name every item.
      return ` Items: ${catalog.entities.filter((e) => e.kind !== "disease" && e.was[page]).map((e) => e.name).join("; ")}.`;
    case "outcomes":
      return ` Outcomes include ${catalog.outcomes.filter((o) => o.level === "system").map((o) => `${o.name} diseases`).join(", ")}.`;
    default:
      return "";
  }
}

function firstRound(catalog: Catalog, candidates: Entity[]) {
  const settings = [...new Set([...(catalog.settings.utilwas_presence ?? []), ...(catalog.settings.utilwas_count_present ?? [])])];
  const questions: Record<string, Question> = {
    page: choice(
      "Which page of the OSA Atlas, a research website on obstructive sleep apnea (OSA), best answers `request`?",
      Object.fromEntries(
        Object.entries(PAGES).map(([key, { page, description }]) => [key, description + pageCoverage(catalog, page)]),
      ),
    ),
    names_feature: {
      type: "noul",
      instructions:
        "Apart from OSA or sleep apnea itself, which every page studies, does `request` name one specific disease, symptom, lab test, medication, questionnaire item, procedure, medical specialty, behavior or outcome?",
      criteria: {
        true: "It names one specific item, such as psoriasis, a lab analyte, an anticoagulant, a questionnaire score, an echocardiogram, dermatology visits or a vaccination.",
        false: "It names only OSA, a page, a chart, a setting, a phenotype or a broad group such as labs or heart disease, or no item at all.",
      },
    },
    asks_count: {
      type: "noul",
      instructions: "Does `request` explicitly ask how many times something happens, or for a number or count?",
      criteria: {
        true: "It asks for a count, such as how many visits or the number of diagnoses.",
        false: "It asks about something without asking for a count.",
      },
    },
    body_system: choice(
      "Apart from OSA or sleep apnea itself, which body system does the disease, symptom or topic in `request` belong to?",
      Object.fromEntries(catalog.bodySystems.map((system) => [system, categoryLabel("phecode", system)])),
      "The request concerns no disease or body system",
    ),
    model: choice(
      "Which statistical adjustment does `request` ask for?",
      Object.fromEntries(Object.entries(MODEL_DESCRIPTIONS).map(([id, text]) => [id, `${MODEL_LABELS[id] ?? id}: ${text}`])),
      "The request does not mention adjustment",
    ),
    contrast: choice(
      "Which comparison of OSA severity does `request` ask for?",
      Object.fromEntries(Object.entries(CONTRAST_DESCRIPTIONS).map(([id, text]) => [id, `${CONTRAST_LABELS[id] ?? id}: ${text}`])),
      "The request does not mention a severity comparison",
    ),
    window: choice(
      "Which look-back time window does `request` ask for?",
      { "1yr": "Within 1 year", "5yr": "Within 5 years", lifetime: "Lifetime, ever" },
      "The request does not mention a time window",
    ),
    cpap_window: choice(
      "Which CPAP landmark grace period does `request` ask for?",
      { "90": "90-day landmark", "180": "180-day landmark" },
      "The request does not mention a landmark period",
    ),
    view: choice(
      "Which chart does `request` ask for?",
      {
        manhattan: "Manhattan plot",
        volcano: "Volcano plot of effect size against significance",
        heatmap: "Heatmap comparing all phenotypes",
        profile: "Profile of one phenotype",
      },
      "The request does not mention a chart",
    ),
    measure: choice(
      "Which measure does `request` ask for?",
      Object.fromEntries(Object.entries(MEASURES).map(([key, { description }]) => [key, description])),
      "The request does not mention a measure",
    ),
    setting: choice(
      "Which care setting does `request` ask about?",
      Object.fromEntries(settings.map((s) => [s, s.replaceAll(" · ", ", ")])),
      "The request does not mention a care setting",
    ),
    octant: choice(
      "Which OSA phenotype does `request` name?",
      Object.fromEntries(catalog.octants.map((o) => [o.id, `${o.label}: ${o.summary}`])),
      "The request names no phenotype",
    ),
  };
  for (const [family, categories] of Object.entries(catalog.familyCategories) as [Exclude<WasFamily, "utilwas">, string[]][]) {
    questions[`category_${family}`] = choice(
      `If \`request\` asks about a group of ${FAMILY_CATEGORY_TOPICS[family]}, which group?`,
      Object.fromEntries(categories.map((c) => [c, categoryLabel(family, c)])),
      "The request names no group",
    );
  }
  let byKey = new Map<string, Entity>();
  if (candidates.length > 0) {
    const candidateChoice = entityChoice(candidates);
    questions.candidate = candidateChoice.question;
    byKey = candidateChoice.byKey;
  }
  return { questions, byKey };
}

function hasTarget(entity: Entity, page: PageId): boolean {
  return page in entity.codes || page in entity.was;
}

/** Feature-tree groups for a page: each is a set of entities with the prior probability of its branch. */
function treeGroups(catalog: Catalog, page: PageId, answers: Record<string, Answer>): { prior: number; entities: Entity[] }[] {
  const { entities } = catalog;
  const byBodySystem = (members: Entity[]) => {
    const systems = distribution(answers.body_system).filter(([key]) => key !== NOT_SPECIFIED);
    const mass = systems.reduce((sum, [, p]) => sum + p, 0) || 1;
    return systems
      .map(([system, p]) => ({ prior: p / mass, entities: members.filter((e) => e.category === system) }))
      .filter((group) => group.entities.length > 0)
      .slice(0, TREE_BEAM);
  };
  switch (page) {
    case "profiles":
      return [];
    case "phedas-prevalence":
    case "phedas-incidence":
      return byBodySystem(entities.filter((e) => e.codes[page] === e.id && e.kind === "disease"));
    case "utilwas":
      return specified(answers.measure) === "specialty_visits"
        ? [{ prior: 1, entities: entities.filter((e) => e.kind === "specialty") }]
        : byBodySystem(entities.filter((e) => e.kind === "disease" && e.was.utilwas));
    case "curves-severity":
    case "curves-cpap":
    case "outcomes":
      return [{ prior: 1, entities: entities.filter((e) => e.codes[page as CodePage] === e.id) }];
    default:
      return [{ prior: 1, entities: entities.filter((e) => e.kind !== "disease" && e.was[page as WasFamily]) }];
  }
}

export async function routePrompt(prompt: string, { catalog, decide, retrieve }: AskDeps): Promise<AskResult> {
  const state = { request: prompt };
  const first = firstRound(catalog, retrieve(prompt));
  const round1 = await decide(state, first.questions);
  const { answers } = round1;
  let rounds = 1;
  let cost = round1.cost;

  const pages = distribution(answers.page).flatMap(([key]) => (PAGES[key] ? [PAGES[key].page] : []));
  let page = pages[0] ?? "phedas-prevalence";
  const yes = (answer: Answer | undefined) => answer?.type === "noul" && answer.noul >= THRESHOLDS.yes;
  const namesFeature = yes(answers.names_feature);

  // A confident candidate the chosen page shows skips the tree; otherwise the page's own tree decides.
  const [candidate] = distribution(answers.candidate);
  const picked = candidate && candidate[1] >= THRESHOLDS.candidate ? first.byKey.get(candidate[0]) : undefined;
  let entity = picked && hasTarget(picked, page) ? picked : null;

  const groups = namesFeature && entity === null ? treeGroups(catalog, page, answers) : [];
  if (groups.length > 0) {
    const leaves = groups.map((group) => entityChoice(group.entities));
    const round2 = await decide(state, Object.fromEntries(leaves.map((leaf, i) => [`leaf_${i}`, leaf.question])));
    rounds = 2;
    cost += round2.cost;
    let bestScore = 0;
    leaves.forEach((leaf, i) => {
      const [top] = distribution(round2.answers[`leaf_${i}`]);
      if (!top || top[0] === NONE) return;
      // Path score: geometric mean of the branch and leaf probabilities (TypeSafe hierarchical classification).
      const score = Math.sqrt(groups[i].prior * top[1]);
      if (score > bestScore) {
        bestScore = score;
        entity = leaf.byKey.get(top[0]) ?? null;
      }
    });
    // The page's tree found nothing, but a confident candidate lives elsewhere: go to its most likely page.
    const shown = entity === null && picked ? pages.find((p) => hasTarget(picked, p)) : undefined;
    if (shown && picked) {
      page = shown;
      entity = picked;
    }
  }

  const family = page as Exclude<WasFamily, "utilwas">;
  const counts = yes(answers.asks_count);
  const plan: Plan = {
    page,
    entity,
    analyses: [...(counts ? ["utilwas_count_present"] : []), ...(MEASURES[specified(answers.measure) ?? ""]?.analyses ?? [])],
    model: specified(answers.model),
    contrast: specified(answers.contrast),
    window: specified(answers.window),
    cpapWindow: specified(answers.cpap_window),
    view: specified(answers.view),
    setting: specified(answers.setting),
    octant: specified(answers.octant),
    category: family in catalog.familyCategories ? specified(answers[`category_${family}`]) : specified(answers.body_system),
  };
  return { href: buildHref(catalog, plan), rounds, cost };
}
