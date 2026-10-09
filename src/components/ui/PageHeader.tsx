import type { ReactNode } from "react";

export function PageHeader(props: { title: string; children?: ReactNode }) {
  const { title, children } = props;
  return (
    <div className="flex flex-col gap-5 pt-12 pb-8 md:flex-row md:items-end md:justify-between md:gap-8">
      <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] md:text-[48px] md:leading-[1.08]">
        {title}
      </h1>
      {children && <div className="flex flex-wrap items-center gap-3 md:justify-end">{children}</div>}
    </div>
  );
}
