export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  children: NavChild[];
}

export const NAV: NavItem[] = [
  {
    label: "PheDAS",
    href: "/phedas/prevalence",
    children: [
      { label: "Prevalence", href: "/phedas/prevalence" },
      { label: "Incidence", href: "/phedas/incidence" },
    ],
  },
  {
    label: "Other WAS",
    href: "/was/labwas",
    children: [
      { label: "LabWAS", href: "/was/labwas" },
      { label: "MedWAS", href: "/was/medwas" },
      { label: "QWAS", href: "/was/qwas" },
      { label: "ProcWAS", href: "/was/procwas" },
      { label: "UtilWAS", href: "/was/utilwas" },
      { label: "BehWAS", href: "/was/behwas" },
    ],
  },
  {
    label: "Phenotypes",
    href: "/phenotypes",
    children: [
      { label: "Profiles", href: "/phenotypes" },
      { label: "Outcomes", href: "/phenotypes/outcomes" },
    ],
  },
  {
    label: "Incidence curves",
    href: "/incidence/severity",
    children: [
      { label: "OSA severity", href: "/incidence/severity" },
      { label: "CPAP adherence", href: "/incidence/cpap" },
    ],
  },
];
