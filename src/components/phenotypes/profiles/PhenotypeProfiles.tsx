"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OctantPicker } from "@/components/phenotypes/profiles/OctantPicker";
import { ProfileDetail } from "@/components/phenotypes/profiles/ProfileDetail";
import { ProfileHeatmap } from "@/components/phenotypes/profiles/ProfileHeatmap";
import type { ProfilesData, ProfileView } from "@/components/phenotypes/profiles/model";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const VIEW_OPTIONS = [
  { value: "profile", label: "Profile" },
  { value: "heatmap", label: "Heatmap" },
];

export function PhenotypeProfiles(props: { data: ProfilesData }) {
  const { octants, domains, cpap } = props.data;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const octant = octants.find((o) => o.id === searchParams.get("octant")) ?? octants[0];
  const view: ProfileView = searchParams.get("view") === "heatmap" ? "heatmap" : "profile";

  const update = (next: { octant?: string; view?: ProfileView }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.octant !== undefined) {
      if (next.octant === octants[0].id) params.delete("octant");
      else params.set("octant", next.octant);
    }
    if (next.view !== undefined) {
      if (next.view === "profile") params.delete("view");
      else params.set("view", next.view);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div>
      <OctantPicker octants={octants} selectedId={octant.id} onSelect={(id) => update({ octant: id })} />
      <div className="mt-10">
        <SegmentedControl
          ariaLabel="View"
          value={view}
          options={VIEW_OPTIONS}
          onChange={(value) => update({ view: value === "heatmap" ? "heatmap" : "profile" })}
        />
      </div>
      <div className="mt-10">
        {view === "profile" ? (
          <ProfileDetail key={octant.id} octant={octant} domains={domains} cpap={cpap} />
        ) : (
          <ProfileHeatmap
            octants={octants}
            domains={domains}
            selectedId={octant.id}
            onSelect={(id) => update({ octant: id, view: "profile" })}
          />
        )}
      </div>
    </div>
  );
}
