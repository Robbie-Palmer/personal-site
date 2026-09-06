export function requiredEnv(
  name: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const value = environment[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
