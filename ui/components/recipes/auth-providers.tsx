import { siGithub, siGoogle } from "simple-icons";

export type Provider = "google" | "github";

export const AUTH_PROVIDERS: ReadonlyArray<{
  id: Provider;
  name: string;
  iconPath: string;
}> = [
  { id: "google", name: "Google", iconPath: siGoogle.path },
  { id: "github", name: "GitHub", iconPath: siGithub.path },
];

export function ProviderIcon({
  path,
  className = "size-4",
}: {
  path: string;
  className?: string;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path d={path} fill="currentColor" />
    </svg>
  );
}
