import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // /api/ask reads these at request time; Vercel serves public/ from its CDN, so they must be traced into the function.
  outputFileTracingIncludes: {
    "/api/ask": [
      "./public/data/features.json",
      "./public/data/was-features.json",
      "./public/data/survival-manifest.json",
      "./public/data/phenotypes.json",
      "./public/data/atlas-manifest.json",
      "./public/data/was-manifest.json",
    ],
  },
  // readPublicJson's dynamic path makes the tracer pull in all of public/data (~56 MB); /api/ask needs none of the partitions.
  outputFileTracingExcludes: {
    "/api/ask": ["./public/data/{phedas,was,survival,phenotype-survival}/**", "./public/data/was-utilization-profile.json"],
  },
  turbopack: {
    // A stray lockfile in the home directory would otherwise make Turbopack infer the wrong workspace root.
    root: __dirname,
    rules: {
      "*.css": {
        // Renaming via `as` would turn x.module.css into global CSS with no class exports; modules need no Tailwind.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
