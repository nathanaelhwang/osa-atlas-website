"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { WasPageConfig } from "@/lib/was-config";
import { resolveWasState, wasQuery, type WasParams, type WasState } from "@/lib/was-state";

export type WasPatch = Partial<WasParams>;

/** WAS page state held in the URL query; `update` merges a patch, re-resolves, and replaces the URL. */
export function useWasState(config: WasPageConfig): [WasState, (patch: WasPatch) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params = useMemo<WasParams>(
    () => ({
      analysis: searchParams.get("analysis"),
      window: searchParams.get("window"),
      model: searchParams.get("model"),
      contrast: searchParams.get("contrast"),
      category: searchParams.get("category"),
      setting: searchParams.get("setting"),
      view: searchParams.get("view"),
      feature: searchParams.get("feature"),
    }),
    [searchParams],
  );
  const state = useMemo(() => resolveWasState(config, params), [config, params]);

  const update = useCallback(
    (patch: WasPatch) => {
      const query = wasQuery(config, resolveWasState(config, { ...params, ...patch }));
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [config, params, router, pathname],
  );

  return [state, update];
}
