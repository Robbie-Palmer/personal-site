export function parseArgs(argv: string[]): Record<string, string>;
export function parseArgs<const Required extends readonly string[]>(
  argv: string[],
  required: Required,
): Record<string, string> & Record<Required[number], string>;
export function parseArgs(argv: string[], required: readonly string[] = []): Record<string, string> {
  const values: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) throw new Error(`unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value`);
    values[key.slice(2)] = value;
    index += 1;
  }
  for (const key of required) {
    if (!values[key]?.trim()) throw new Error(`--${key} is required`);
  }
  return values;
}
