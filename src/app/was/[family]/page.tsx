import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WasFallback } from "@/components/was/WasFallback";
import { WasPage } from "@/components/was/WasPage";
import { getWasPageConfig } from "@/lib/data/server";
import { WAS_FAMILY_SLUGS } from "@/lib/was-config";

export function generateStaticParams() {
  return WAS_FAMILY_SLUGS.map((family) => ({ family }));
}

export async function generateMetadata({ params }: PageProps<"/was/[family]">): Promise<Metadata> {
  const { family } = await params;
  const slug = WAS_FAMILY_SLUGS.find((s) => s === family);
  return slug ? { title: getWasPageConfig(slug).title } : {};
}

async function FamilyWas({ params }: Pick<PageProps<"/was/[family]">, "params">) {
  const { family } = await params;
  const slug = WAS_FAMILY_SLUGS.find((s) => s === family);
  if (!slug) notFound();
  const config = getWasPageConfig(slug);
  return (
    <Suspense fallback={<WasFallback title={config.title} />}>
      <WasPage config={config} />
    </Suspense>
  );
}

export default function WasFamilyPage({ params }: PageProps<"/was/[family]">) {
  return (
    <Suspense fallback={<WasFallback />}>
      <FamilyWas params={params} />
    </Suspense>
  );
}
