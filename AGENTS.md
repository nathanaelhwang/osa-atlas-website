<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OSA Atlas: project guide for agents

This is the public website for a phenome-wide association study (PheWAS) of obstructive sleep apnea (OSA). The study covers 222,109 adults who had diagnostic sleep testing at Kaiser Permanente Southern California from 2016 to 2025. The exposure is the apnea–hypopnea index (AHI). Severity groups are none (<5), mild (5–15), moderate (15–30) and severe (≥30). The primary contrast is AHI ≥5 vs <5. Models: M1 unadjusted; M2 adds demographics; M3 adds smoking and neighborhood income; M4 adds BMI (fully adjusted, the primary model). Bonferroni is the primary significance criterion and FDR is secondary.

The manuscript, supplement, and tables and figures are `.docx` files in `manuscript-docs-for-context/`. To see the figures, unzip `word/media/*.png` from "PheWAS Tables and Figures …docx". Figure 1 is PheDAS prevalence, 2A–C LabWAS, 3 MedWAS, 4 ProcWAS, 5 UtilWAS, 6 QWAS, 7 BehWAS, 8 PheDAS incidence, 9 incidence curves by severity and by CPAP, 10 the phenotype heatmap, 11 the phenotype forest plot, and 12 the heart-failure curves by phenotype. Never edit these documents. The user's global rule requires a dated duplicate before any manuscript edit.

## User's design brief (binding)

- "Very simple. White background, black sans-serif font. MINIMAL WORDS, KEEP CONCISE. Act like this is Apple's UI." The user's sketches are rough, so apply proper design judgment.
- Home: an immersive Manhattan plot background built from real data, colored by body system, with **no static text in the background**. It runs edge to edge (sides and bottom). Hovering a point shows the same tooltip as the WAS Manhattan plots (`PlotTooltip`); touch has no hover. In the middle, "Ask anything" above a big text box whose example prompts type out and backspace. The nav sits top right. The home `<main>` is `pointer-events-none` with only its content `pointer-events-auto`, so the pointer reaches the canvas.
- WAS template, shared by every association page: the WAS title; dropdowns for Exposure, Adjustment and Disease category (plus Measure, Window and Setting when the page has more than one option); Manhattan by default with a Volcano tab; points colored by body system as in the manuscript; clicking a point opens a right panel with the effect (odds ratio etc.), 95% CI, p-value, FDR significant and Bonferroni significant.
- Sitemap: Home → PheDAS (Prevalence, Incidence) | Other WAS (LabWAS, MedWAS, QWAS, ProcWAS, UtilWAS, BehWAS; each its own page) | Phenotypes (8 profiles; **outcomes on a separate page**) | Incidence curves (OSA severity, CPAP adherence).
- The "Ask anything" box sends users to the page and feature they asked about. It routes with Jev (a decision model on OpenRouter) and falls back to a keyword router. The same box floats at the bottom center of every page except home.

## Stack and commands

Next.js 16.4 (App Router, `src/`, alias `@/*` → `src/*`), React 19.3, TypeScript (strict), Tailwind CSS v4 (configured in CSS in `src/app/globals.css`; there is no tailwind config file), d3-scale, d3-shape and d3-array. Charts are hand-written SVG or canvas; do not add a chart or UI library. The only backend is the `/api/ask` route handler. The code is on GitHub at `nathanaelhwang/osa-atlas-website`; commit or push only when the user asks.

```bash
npm run dev        # dev server
npm run typecheck  # next typegen && tsc --noEmit (typegen generates the global LayoutProps and PageProps types)
npm run lint
npm run build
npm run eval:ask   # tsx: scores ask routers against scripts/ask-eval.jsonl (--labels, --designs, --misses); calls Jev
```

Check a change by running typecheck, lint and build, then opening the affected routes in a browser at desktop width and at about 390px (no console errors; try the interaction you changed). Python is used only for inspecting data, run with `uv run --with <pkg> python`. Never use conda or pip.

### Next 16 rules that will break the build if ignored

- `next.config.ts` turns on `cacheComponents` and `partialPrefetching`.
  - A client component that calls `useSearchParams()` must sit inside a `<Suspense>` in its page. Give the fallback the same height as the content (see `WasFallback`).
  - Server components must not do uncached async IO outside Suspense. Data needed at build time comes from `readPublicJson()`, which reads files synchronously and caches them.
  - Dynamic `params` is a Promise. Await it inside a Suspense child (pattern: `src/app/was/[family]/page.tsx`). As a result, an unknown slug renders the not-found page with HTTP 200 plus `noindex` (a soft 404).
- After you navigate away, routes stay mounted but hidden (React `<Activity>`). Every effect that adds a listener, observer, timer or animation loop must clean it up.
- `turbopack.root` is pinned to `__dirname` because of a stray lockfile in the home directory. Leave it.
- The Tailwind loader rule in `turbopack.rules` skips `*.module.css`; its `as: "*.css"` rename would otherwise turn CSS modules into global CSS with no class exports.

## Deployment (Vercel)

- The site is meant to run on Vercel, connected to the GitHub repo: pushes to `main` deploy to production, and other branches and pull requests get preview URLs. It uses Vercel's default Next.js settings, with no `vercel.json`. Keep Cache Components on. Do not add `output: "export"`: that was only needed for Cloudflare, which was not chosen.
- Vercel's free Hobby plan allows only personal, non-commercial use. On that plan, going over a monthly limit stops that feature until 30 days have passed. The user decides the plan. Mention this if a change could greatly increase function or bandwidth use.
- Every page is pre-built at build time. Request-time server code: an unknown `/was/<slug>` (calls `notFound()` before reading any data) and `POST /api/ask`. Don't assume request-time code can read `public/data` from the file system: Vercel serves `public/` from its CDN. `/api/ask` reads six registries/manifests through `readPublicJson`, listed in `outputFileTracingIncludes`; `outputFileTracingExcludes` keeps the ~56 MB of partitions out of that function. Update both lists if the router reads another file.
- `/api/ask` needs `OPENROUTER_API_KEY` (Vercel environment variable and local `.env.local`; never `NEXT_PUBLIC_*`). It is rate-limited by a Vercel firewall rule (POST `/api/ask`, per IP, 20 per 60 s → 429) configured in the dashboard, not in code. Jev costs about $0.30 per 1,000 asks. `maxDuration` is 10 s.
- The site's metadata sets its address (`metadataBase`) to `https://www.osaatlas.com`, so social preview images resolve there. Point that domain at this Vercel project, or change `metadataBase`, when the site goes live.

## Data (read `data/README_20261008.txt` first)

- `data/` is the original transfer package; treat it as read-only. `public/data/**` and `public/images/**` are byte-for-byte copies of it, served at `/data/…` and `/images/…`. Never edit either copy.
- Partition files store `columns` as parallel arrays: index i across all arrays is one record. Keep IDs as strings (PheCodes like `"401.1"`).
- **Never turn null, withheld or suppressed values into 0.** Suppressed counts display as `<11`; missing values display as `—`.
- `p === 0` appears in 832 LabWAS/UtilWAS rows: it means numeric underflow, and these are the *most* significant rows. `AssocRow.pZero` marks them; they are plotted at the y cap and shown as `< 10⁻³⁰⁸`.
- **Omnibus** (`contrast === "omnibus"`, "Any severity difference") is a non-directional joint test. PheDAS incidence omnibus files still say `effect_type: "HR"`, but `loadPartition` forces `directional: false`. In that case Volcano is disabled, markers are circles, and the panel hides ratio effects.
- Effect types: OR/HR/IRR are ratios (neutral value 1, log scale); `beta` is a rank-inverse-normal SD β (neutral 0); `wald_F` and `wald_chi2` are omnibus statistics. Do not compare effect sizes across analysis families.

| File | Contents |
|---|---|
| `atlas-manifest.json` | 48 PheDAS partitions: `phedas/{prevalence\|incidence}/{m1..m4}/{contrast}.json`. Row key is `feature_id`; incidence files add `n_atrisk` and `n_events`. Prevalence has no trend or omnibus contrast. |
| `was-manifest.json` (454 KB, server only) | 13 analyses and 568 partitions: `was/{analysis_id}/{window}/{model}/{contrast}.json`. Row key is `feature_key` (the same key across windows, models and contrasts). Metadata includes `effect_type`, `effect_scale`, `neutral_value` and `directional`. |
| `features.json`, `was-features.json` | Feature registries: 1,803 PheCodes and 1,362 non-disease features, with alternate names |
| `survival-manifest.json`, `survival/{id}.json` | 39 PheCodes with incidence curves, stored long-format (`group`, `time_years`, `cif_pct` already in %). CPAP curves are split by `window_days` (180 or 90); `omitted_strata` lists groups dropped for small counts. Count tables are withheld. |
| `phenotypes.json` | The 8 octants, 26 profile measures (`by_octant` values with standardized differences), CPAP setup summaries (`*_pct` fields are already percents), and the outcome model panels in `survival.levels` |
| `phenotype-survival/{phecode\|system}/{file}.json` | 21 outcome curve files: each octant vs the other seven, plus No OSA; `curve_status` can be withheld. Manifest `asset_path` values start with `data/`; remove that prefix before fetching. |

WAS families and their analyses: labwas (mean, median, order_rate, order_propensity), medwas (fill; has no omnibus), behwas (binary, continuous; windows 1yr, 5yr, lifetime), procwas (rate; models M1–M4), utilwas (presence and count_present by care-setting subgroup; specialty_rate by Physician/Allied subgroup), qwas (binary, continuous; window `index` only; models M1–M4).

## Architecture

```
src/lib/data/types.ts     AssocRow, Partition, EffectType
src/lib/data/client.ts    loadPartition(path), fetchJson<T>(path)  (cached per path; failed fetches are dropped from the cache)
src/lib/data/server.ts    "server-only": readPublicJson<T>(relPath), getWasPageConfig(slug)
src/lib/data/format.ts    formatP, formatEffect, formatCI, formatInt, formatPct (takes a FRACTION)
src/lib/data/labels.ts    CONTRAST_ORDER/LABELS, MODEL_LABELS, WINDOW_LABELS, EFFECT_LABELS
src/lib/plot/manhattan.ts manhattanLayout (x positions in [0,1] by group), yCap (cap 50 when any pZero or max > 60)
src/lib/was-config.ts     WasSlug, WAS_FAMILY_SLUGS, WasAnalysisConfig, WasPageConfig (types only; importable anywhere)
src/lib/palettes.ts       CATEGORY_PALETTES + categoryColor/Label/Order; SEVERITY_COLORS, CPAP_COLORS, OCTANT_COLORS, NO_OSA_COLOR
src/lib/site.ts           NAV (the sitemap; drives SiteNav)
src/lib/was-state.ts      resolveWasState, wasQuery (WAS URL ↔ state; shared by useWasState and the ask router)
src/lib/ask/resolve.ts    resolveAsk(prompt) → href (client: POST /api/ask, keyword fallback on any failure)
src/lib/ask/keyword.ts    keyword router (fallback; pure, takes the registry)
src/lib/ask/catalog.ts    "server-only": getAskCatalog() — entities (diseases, labs, meds, items, procedures, specialties, behaviors), page configs, pools
src/lib/ask/retrieve.ts   createRetriever(entities): prompt → ≤20 candidates by word overlap
src/lib/ask/jev.ts        "server-only": decide(state, questions) on OpenRouter's Decisions API, pinned typesafe/jev-1.13
src/lib/ask/router.ts     "server-only": routePrompt — Jev questions, thresholds, feature tree
src/lib/ask/href.ts       buildHref(catalog, plan): the canonical URL the destination page would write
src/app/api/ask/route.ts  POST { prompt } → { href }; 400 bad input, 503 on any Jev failure
src/components/ui/        Select, SegmentedControl (+SegmentTrack), TabLinks, PageHeader, SidePanel, Legend, ComboBox
src/components/charts/    ManhattanPlot, VolcanoPlot (AssocPlotProps in plot-shared.tsx), CifChart (y values in PERCENT)
src/components/was/       WasPage, WasControls, FeatureDetail, useWasState, WasFallback
src/components/ask/       AskBox (typewriter; `large` for the home hero), AskDock (layout-mounted floating box, hidden on `/`)
src/components/home/      HomeBackground (canvas + hover tooltip), useReducedMotion
src/components/phenotypes/{profiles,outcomes}/, src/components/incidence/
```

- **Data flow:** server pages call `readPublicJson`/`getWasPageConfig` and pass small, serializable props to client components. Client components fetch partitions and curve files at runtime. Never import `server.ts` or large manifests into client code.
- **State lives in the URL**, using query params and `router.replace(url, { scroll: false })`, with defaults left out of the URL. Every view can be deep-linked, and the ask router depends on this:
  - WAS pages: `analysis`, `window`, `model` (M1–M4, case-insensitive), `contrast`, `category`, `setting`, `view` (`manhattan` or `volcano`), `feature` (the row key). `useWasState` falls back so that it always lands on a partition that exists.
  - Incidence curves: `feature`, plus `window` (`180` or `90`) on the CPAP page.
  - Phenotype profiles: `octant`, `view` (`profile` or `heatmap`). Phenotype outcomes: `outcome`, `octant`.
- **Shared code:** `OctantGlyph`/`octantLabel` live in `phenotypes/profiles/OctantGlyph.tsx` and the outcomes page uses them too.
- **Defaults:** contrast `ahi_ge5`, model M4, window `5yr` (QWAS `index`). Default analyses are LabWAS median, UtilWAS presence, QWAS and BehWAS binary. The incidence curves default to 401.1; phenotype outcomes default to 428.2.
- **Ask box:** round 1 is one Jev request with every question in parallel (page, settings, "names a feature?", count, and a choice among retrieved candidates). A candidate with P ≥ 0.6 that the chosen page shows is used directly; otherwise, when a feature is named, round 2 walks the chosen page's list (body system → feature for PheDAS/UtilWAS, top 3 systems in parallel; the whole list, ≤255 options, elsewhere). If that finds nothing, a confident candidate moves the user to the most likely page that shows it. A Jev Choice takes at most 255 options and output only from the options given; never let Jev produce a URL. Option names and descriptions are sent to the model: describe pages by their data (`pageCoverage`), and never copy eval prompts into descriptions. Tune only against `scripts/ask-eval.jsonl`; `scripts/ask-eval-holdout.jsonl` measures generalization and must not be tuned against.

## Design system (`src/app/globals.css`)

- Tokens (Tailwind names): `canvas` #FFFFFF, `ink` #000000, `muted` #6E6E73, `hairline` #D2D2D7, `hairline-soft` #E8E8ED (gridlines), `fill` #F5F5F7 (control backgrounds), `accent` #0071E3 (focus and active state only). Light mode only.
- Type: the system font first, so Apple devices get SF Pro; Inter (loaded with `next/font`) is the fallback. Body 17px. Page titles 48px (34px on mobile), weight 600, letter-spacing −0.02em. Home heading 56px (40px on mobile). Panel headlines 28px. Controls 14px. Captions and axis ticks 12px. Use `tabular-nums` for numbers.
- **Hard rules:**
  - Sentence case.
  - No ALL-CAPS labels, small labels above headings, monospace data labels, "A · B · C" middle-dot strings (the data's `" · "` in subgroup names is shown as `", "`), "→" in links, emoji, or explanatory paragraphs.
  - Each chart gets at most one line of caption.
- **Layout and motion:**
  - No card styling with shadows. Shadows are allowed only on the ask box, menus and tooltips.
  - Plots sit directly on white.
  - Corner radius by role: pills 9999px, panels and menus 18px, chips 8px. Content container: full width, `w-full px-4 sm:px-6` (no max width; the nav uses the same gutters, so the wordmark sits top left and the links top right).
  - Animate only in response to user actions. Panels slide in 240ms with the `ease-apple` curve.
  - The only animations that play by themselves are the one-time load on the home page and the ask box typewriter. Respect `prefers-reduced-motion`.
  - The ask dock is fixed at `z-index: 15`: above sticky table headers and segment controls (10), below menus (30), the mobile nav sheet (40) and the mobile side-panel sheet (60/70). While the desktop `SidePanel` is open it sets `data-side-panel-open` on `<html>`, and the dock re-centers over the column left of the panel. Pages keep `pb-24` so their last line clears the dock.
- **Data colors come only from `palettes.ts`**, sampled from the manuscript figure legends. The manuscript's LabWAS legend reuses colors for four category pairs; this is kept on purpose. Colors not found in any figure are commented in that file (5 octants and the BehWAS "Leave and work absence" category).
- **Marker conventions (match the manuscript):**
  - Up and down triangles show the effect direction; circles mean non-directional.
  - Bonferroni-significant markers are larger with a dark outline. Non-significant markers are faint on the Manhattan plot; non-FDR markers are faint on the volcano plot.
  - Values are capped at "≥50" on the y-axis. A dashed line marks the Bonferroni threshold.
- Keyboard focus must be visible, icon buttons need accessible names, and layouts must work at 375px wide.

## How to do common changes

- **Add or change a WAS page:** edit `PAGES`, `ANALYSIS_LABELS`, `ANALYSIS_STYLES`, `FAMILY_PALETTES` and `DEFAULT_ANALYSIS` in `src/lib/data/server.ts`. Then update `WasSlug`/`WAS_FAMILY_SLUGS`, `NAV` in `site.ts`, and add a palette in `palettes.ts`. Every category string in the data needs a color, a label and a position in the palette order. For the ask router, add the family to `WasFamily`/`KIND_BY_FAMILY`/`PALETTE_BY_FAMILY` in `src/lib/ask/catalog.ts` and a `PAGES` entry in `router.ts` (new measures go in `MEASURES`), then add labeled prompts and run `npm run eval:ask`.
- **New page:** a server `page.tsx` with `metadata.title`, using `PageHeader` (with `TabLinks` for sibling pages). Read data with `readPublicJson`; put the client UI inside Suspense with a fallback of the same height. Add the page to `NAV`, and to the ask router (`PageId`, `PAGES` in `router.ts`, a case in `href.ts`) if users should be able to ask for it.
- **New chart:** follow `CifChart`/`plot-shared.tsx`. Track width with a ResizeObserver, draw points in one memoized layer, and draw hover and selection on a separate overlay layer. Use 12px muted ticks and `hairline-soft` gridlines.
- `TabLinks` marks the active tab only when the link exactly matches the current path, so links with query strings never show as active.

## Coding conventions

- No `any`. Don't wrap a single expression in a function unless the name is a domain concept or it is used in 3 or more places. No TODOs, stubs or dead code. Don't add dependencies without a clear need.
- Keep these documents in sync with behavior:
  - `README.md` for humans.
  - This file for agents.
