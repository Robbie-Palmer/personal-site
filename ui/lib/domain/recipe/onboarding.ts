export function buildRecipeAuthoringHref(selectedSlugs: string[]): string {
  const returnParams = new URLSearchParams({ step: "box", draft: "1" });
  for (const slug of new Set(selectedSlugs)) {
    returnParams.append("selected", slug);
  }

  return `/recipes/add?returnTo=${encodeURIComponent(
    `/recipes/onboarding?${returnParams.toString()}`,
  )}`;
}

export function resolveOnboardingRecipeSelection(
  search: string,
  persistedSlugs: string[],
  availableSlugs: ReadonlySet<string>,
): string[] {
  const params = new URLSearchParams(search);
  const source =
    params.get("draft") === "1" ? params.getAll("selected") : persistedSlugs;

  return Array.from(new Set(source.filter((slug) => availableSlugs.has(slug))));
}
