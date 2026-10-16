# OSA Atlas

Website for the OSA phenome-wide atlas. Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, and d3 scales and shapes.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # next typegen + tsc
npm run lint
npm run eval:ask   # score the ask router against labeled prompts (needs OPENROUTER_API_KEY)
```

For local work on the ask box, put `OPENROUTER_API_KEY=sk-or-...` in `.env.local` (gitignored). Without it the box still works through the keyword fallback.

## Deploy

The site deploys to Vercel. To set it up, open the Vercel dashboard, choose **Add New → Project**, import `nathanaelhwang/osa-atlas-website`, and deploy with the default Next.js settings. You don't need a `vercel.json`. After that, every push to `main` deploys to production, and every other branch and pull request gets its own preview URL.

The ask box needs two settings in the Vercel dashboard:

- Environment variable `OPENROUTER_API_KEY` (Production, and Preview if previews should use Jev). Changes apply to the next deployment. Set a credit limit on the key in OpenRouter.
- Firewall rate-limit rule (Firewall → Configure → New Rule): if request path equals `/api/ask` and method is `POST`, rate-limit by IP, fixed window 60 s, 20 requests, action 429. Hobby allows one rate-limit rule per project; publish it to apply it to production.

Vercel's free Hobby plan is for personal, non-commercial use only; commercial use needs Pro. When the site goes live, point `www.osaatlas.com` at the Vercel project. The site's metadata uses that address for social preview images.

## Routes

| Route | Content |
|---|---|
| `/` | Manhattan plot background (PheDAS prevalence, M4, AHI ≥5 vs <5; hover a point for its name) and the "Ask anything" box |
| `/phedas/prevalence`, `/phedas/incidence` | PheDAS pages built from the WAS template |
| `/was/{labwas,medwas,qwas,procwas,utilwas,behwas}` | Other WAS pages built from the WAS template |
| `/phenotypes` | The 8 octant profiles: profile view and heatmap |
| `/phenotypes/outcomes` | Phenotype outcome forest plot and cumulative-incidence curves |
| `/incidence/severity`, `/incidence/cpap` | Cumulative incidence by OSA severity and by CPAP adherence |

WAS pages keep their state in the URL: `analysis`, `window`, `model`, `contrast`, `category`, `setting`, `view` (`manhattan` or `volcano`), and `feature`. A link like `/phedas/prevalence?feature=401.1` opens the detail panel for that feature. Incidence pages take `feature` (and `window` on the CPAP page). Phenotype pages take `octant` and `view` on profiles, and `outcome` and `octant` on outcomes.

## Ask box

The box sits in the middle of the home page and floats at the bottom of every other page (`AskDock`, mounted in the root layout). `resolveAsk(prompt)` in `src/lib/ask/resolve.ts` POSTs to `/api/ask` and returns the path to open, or null when Jev refuses the prompt as unrelated to the atlas; the box then stays put, flashes its outline red and shows "Try another prompt" until the text is edited. Any failure (firewall 429, Jev outage, missing key, 6 s timeout) falls back to the keyword router in `src/lib/ask/keyword.ts`, which never refuses.

`/api/ask` routes with Jev, TypeSafe's decision model on OpenRouter (`typesafe/jev-1.13`, pinned). Jev never writes text; it picks from options the code defines, so every link is built by code from valid page parameters.

1. Code retrieves up to 20 candidate features whose names share words with the prompt (`retrieve.ts`).
2. One Jev request asks every question in parallel: whether the prompt concerns health or the site at all, the page, the settings (model, contrast, window, view, measure, setting, octant, category), whether a feature is named, and which candidate it is. A P(on topic) below 0.15 refuses the prompt (`{ href: null }`); the cutoff is low because a wrong refusal costs more than a wrong page.
3. If no confident candidate exists on the chosen page, a second request walks that page's feature list: body system, then feature for PheDAS and UtilWAS (top 3 systems in parallel), or the whole list for smaller pages.
4. `href.ts` builds the URL the destination page itself would write, leaving defaults out.

`npm run eval:ask` scores the keyword router, a tree-only design and the shipped router against `scripts/ask-eval.jsonl` (200 prompts, 20 of them off-topic with `href: null`, used for tuning). It reports false refusals (on-topic prompts refused) and missed refusals. `--labels scripts/ask-eval-holdout.jsonl` (70 prompts, 10 off-topic) scores the held-out set; never tune against it. Re-run both before changing the Jev version or the thresholds in `router.ts`.

## Data

`public/data/` and `public/images/` are verbatim copies of `data/data/` and `data/images/` from the October 8, 2026 transfer package (`data/README_20261008.txt`). Do not edit them. Server code reads the manifests at build time (`src/lib/data/server.ts`). The browser fetches partitions when it needs them (`src/lib/data/client.ts`). Null and suppressed values are never shown as zero.

## Layout

- `src/lib/palettes.ts`: category, severity, CPAP, and octant colors, sampled from the manuscript figures
- `src/lib/data/`: types, loaders, formatters, labels; `src/lib/was-config.ts`: WAS page config types
- `src/components/ui/`: shared controls; `src/components/charts/`: Manhattan, volcano, and cumulative-incidence charts
- `src/components/{home,was,phenotypes,incidence}/`: page components
- `src/app/globals.css`: design tokens (white canvas, black ink, one accent color for focus)
