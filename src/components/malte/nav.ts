export type NavItem = { to: string; label: string };
export type NavGroup = { title: string; items: NavItem[] };

export const navItems: NavItem[] = [
  { to: "/forza/pripady", label: "Spisy" },
  { to: "/forza/asistent", label: "Autopilot" },
  { to: "/forza/sandbox", label: "Sandbox" },
  { to: "/forza/siet", label: "Sieť" },
  { to: "/forza/viac", label: "Viac" },
];

export const navGroups: NavGroup[] = [
  {
    title: "Prípad",
    items: [
      { to: "/forza/prehlad", label: "Prehľad" },
      { to: "/forza/pripady", label: "Prípady" },
      { to: "/forza/asistent", label: "Forenzný Autopilot" },
      { to: "/forza/sandbox", label: "AI Sandbox" },
      { to: "/forza/import-csv", label: "Import CSV" },
    ],
  },
  {
    title: "Zistenia",
    items: [
      { to: "/forza/analyza-vypisov", label: "Analýza" },
      { to: "/forza/osoby", label: "Osoby" },
      { to: "/forza/vztahy", label: "Vzťahy" },
      { to: "/forza/siet", label: "Sieť tokov" },
      { to: "/forza/zbrane", label: "Zbrane" },
      { to: "/forza/pravny-kontext", label: "Právny kontext" },
    ],
  },
  {
    title: "Účet",
    items: [
      { to: "/forza/profil", label: "Nastavenia profilu" },
      { to: "/forza/integracie", label: "Integrácie a API" },
      { to: "/forza/audit", label: "Audit a integrita" },
      { to: "/forza/predplatne", label: "Predplatné" },
    ],
  },
];

