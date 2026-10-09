import type { Metadata } from "next";
import { IncidencePage } from "@/components/incidence/IncidencePage";

export const metadata: Metadata = { title: "Incidence by CPAP adherence" };

export default function IncidenceCpapPage() {
  return <IncidencePage view="cpap" />;
}
