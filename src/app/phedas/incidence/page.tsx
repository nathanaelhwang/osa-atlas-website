import type { Metadata } from "next";
import { Suspense } from "react";
import { WasFallback } from "@/components/was/WasFallback";
import { WasPage } from "@/components/was/WasPage";
import { getWasPageConfig } from "@/lib/data/server";

export function generateMetadata(): Metadata {
  return { title: getWasPageConfig("phedas-incidence").title };
}

export default function PhedasIncidencePage() {
  const config = getWasPageConfig("phedas-incidence");
  return (
    <Suspense fallback={<WasFallback title={config.title} />}>
      <WasPage config={config} />
    </Suspense>
  );
}
