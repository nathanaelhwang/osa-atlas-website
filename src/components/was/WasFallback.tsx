import { PageHeader } from "@/components/ui/PageHeader";

/** Matches the plots' default heights (360 / 420 ≥sm / 460 ≥lg). */
export const PLOT_BOX = "h-[360px] sm:h-[420px] lg:h-[460px]";

/** Quiet placeholder reserving the header, controls, and plot height while the page resolves. */
export function WasFallback({ title }: { title?: string }) {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-[1280px] px-4 pb-24 sm:px-6">
      {title ? <PageHeader title={title} /> : <div className="h-[117px] md:h-[132px]" />}
      <div className="h-9" />
      <div className="mt-8 h-8" />
      <div className={`mt-4 ${PLOT_BOX}`} />
    </main>
  );
}
