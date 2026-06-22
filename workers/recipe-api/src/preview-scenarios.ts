export const previewScenarios = [
  {
    id: "empty-user",
    name: "Empty account",
    description: "A standard user with no saved recipes.",
    email: "empty-user@preview.invalid",
    role: "user",
  },
  {
    id: "user-with-recipes",
    name: "User with recipes",
    description: "A standard user with private and public recipe fixtures.",
    email: "recipes-user@preview.invalid",
    role: "user",
  },
  {
    id: "admin-user",
    name: "Administrator",
    description: "An administrator with representative recipe fixtures.",
    email: "admin-user@preview.invalid",
    role: "admin",
  },
] as const;

export type PreviewScenario = (typeof previewScenarios)[number];
export type PreviewScenarioId = PreviewScenario["id"];

export function findPreviewScenario(
  id: unknown,
): PreviewScenario | undefined {
  if (typeof id !== "string") return undefined;
  return previewScenarios.find((scenario) => scenario.id === id);
}
