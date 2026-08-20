// Single source of truth for recurring layout/spacing classes.
// Edit values here, not per-page — keeps every screen visually consistent.

export const layout = {
  page: "min-h-screen bg-background",
  nav: "border-b border-border bg-background",
  navInner: "max-w-5xl mx-auto px-6 py-4 flex justify-between items-center",
  container: "max-w-5xl mx-auto px-6 py-8",
  wideContainer: "max-w-7xl mx-auto px-6 py-8",
  section: "space-y-6",
  sidebarGrid: "grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start",
} as const;

export const surface = {
  card: "rounded-xl border border-border bg-card p-6",
  row: "flex items-center gap-4 rounded-lg bg-muted/40 px-4 py-3",
} as const;

export const text = {
  pageTitle: "text-2xl font-semibold text-foreground",
  sectionTitle: "text-lg font-semibold text-foreground mb-4",
  muted: "text-sm text-muted-foreground",
  label: "text-xs uppercase tracking-wide text-muted-foreground",
} as const;

export const badge =
  "text-xs font-medium border border-border rounded-full px-3 py-1 text-muted-foreground";

export const formGroup = "space-y-4";
export const fieldGap = "space-y-1.5";

// Body of a Sheet/flyout panel — SheetHeader already carries p-6, so this
// only needs horizontal padding + bottom, never repeat the top gap.
export const sheetBody = "space-y-4 px-6 pb-6";
