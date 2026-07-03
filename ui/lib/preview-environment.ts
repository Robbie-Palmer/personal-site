export function isPreviewDeployment(hostname: string): boolean {
  return /^pr-\d+\..+\.pages\.dev$/i.test(hostname);
}
