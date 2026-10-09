import type { Metadata } from "next";
import { IncidencePage } from "@/components/incidence/IncidencePage";

export const metadata: Metadata = { title: "Incidence by OSA severity" };

export default function IncidenceSeverityPage() {
  return <IncidencePage view="severity" />;
}
