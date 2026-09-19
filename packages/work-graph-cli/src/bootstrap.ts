export const DOPPLER_BOOTSTRAP_MARKER = "WORK_GRAPH_DOPPLER_BOOTSTRAPPED";

const doesNotNeedApi = (args: readonly string[]): boolean =>
  args.length === 0 ||
  args.includes("--help") ||
  args.includes("-h") ||
  args.includes("--version") ||
  args.includes("-V") ||
  args[0] === "help" ||
  args[0] === "prime";

const hasApiUrlOption = (args: readonly string[]): boolean =>
  args.some((arg) => arg === "--api-url" || arg.startsWith("--api-url="));

export const dopplerBootstrapArgs = (
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  nodeExecutable: string,
  cliScript: string,
): string[] | undefined => {
  if (
    Boolean(environment.WORK_GRAPH_API_URL) ||
    environment[DOPPLER_BOOTSTRAP_MARKER] === "1" ||
    hasApiUrlOption(args) ||
    doesNotNeedApi(args)
  ) {
    return undefined;
  }

  return [
    "run",
    "--project",
    "work-graph",
    "--config",
    "prd_work_graph",
    "--",
    nodeExecutable,
    cliScript,
    ...args,
  ];
};
