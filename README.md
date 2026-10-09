# OSA Atlas

Website for the OSA phenome-wide atlas. Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, and d3 scales and shapes.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # next typegen + tsc
npm run lint
```

## Routes

| Route | Content |
|---|---|
| `/` | Manhattan plot background (PheDAS prevalence, M4, AHI ≥5 vs <5) and the "Ask anything" box |
| `/phedas/prevalence`, `/phedas/incidence` | PheDAS pages built from the WAS template |
| `/was/{labwas,medwas,qwas,procwas,utilwas,behwas}` | Other WAS pages built from the WAS template |
| `/phenotypes` | The 8 octant profiles: profile view and heatmap |
| `/phenotypes/outcomes` | Phenotype outcome forest plot and cumulative-incidence curves |
| `/incidence/severity`, `/incidence/cpap` | Cumulative incidence by OSA severity and by CPAP adherence |

WAS pages keep their state in the URL: `analysis`, `window`, `model`, `contrast`, `category`, `setting`, `view` (`manhattan` or `volcano`), and `feature`. A link like `/phedas/prevalence?feature=401.1` opens the detail panel for that feature. Incidence pages take `feature` (and `window` on the CPAP page). Phenotype pages take `octant` and `view` on profiles, and `outcome` and `octant` on outcomes.

## Ask box

`src/lib/ask.ts` exports `resolveAsk(prompt): Promise<string>`, which returns the URL to open. For now it is a simple keyword and feature-name matcher. To connect the planned LLM service, replace this one function; the box and the navigation stay the same.

## Data

`public/data/` and `public/images/` are verbatim copies of `data/data/` and `data/images/` from the October 8, 2026 transfer package (`data/README_20261008.txt`). Do not edit them. Server code reads the manifests at build time (`src/lib/data/server.ts`). The browser fetches partitions when it needs them (`src/lib/data/client.ts`). Null and suppressed values are never shown as zero.

## Layout

- `src/lib/palettes.ts`: category, severity, CPAP, and octant colors, sampled from the manuscript figures
- `src/lib/data/`: types, loaders, formatters, labels; `src/lib/was-config.ts`: WAS page config types
- `src/components/ui/`: shared controls; `src/components/charts/`: Manhattan, volcano, and cumulative-incidence charts
- `src/components/{home,was,phenotypes,incidence}/`: page components
- `src/app/globals.css`: design tokens (white canvas, black ink, one accent color for focus)
