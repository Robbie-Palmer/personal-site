import {
  CliValidationError,
  Command,
  createCli,
  FailedToExitError,
} from "trpc-cli";
import type { Fetch } from "./client.js";
import {
  createCommandContext,
  globalOptionsSchema,
  type UuidFactory,
  workGraphRouter,
} from "./commands.js";
import {
  CliError,
  errorDocument,
  EXIT_CODES,
  type ExitCode,
  usageError,
} from "./errors.js";

export interface CliDependencies {
  environment?: NodeJS.ProcessEnv;
  fetch?: Fetch;
  makeUuid?: UuidFactory;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
}

const collect = (value: string, previous: string[]): string[] => [
  ...previous,
  value,
];

const nestedCause = (error: unknown): unknown =>
  typeof error === "object" && error !== null && "cause" in error
    ? error.cause
    : undefined;

const findCause = <ErrorType extends Error>(
  error: unknown,
  constructor: new (...args: never[]) => ErrorType,
): ErrorType | undefined => {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current !== undefined && !seen.has(current)) {
    if (current instanceof constructor) return current;
    seen.add(current);
    current = nestedCause(current);
  }
  return undefined;
};

const validationMessage = (error: CliValidationError): string =>
  error.message.split("\n\nUsage:", 1)[0]?.trim() || "Invalid arguments.";

const toCliError = (cause: unknown): CliError => {
  const cliError = findCause(cause, CliError);
  if (cliError) return cliError;

  const validationError = findCause(cause, CliValidationError);
  if (validationError) return usageError(validationMessage(validationError));

  if (cause instanceof FailedToExitError && cause.exitCode !== 0) {
    const parserError = nestedCause(cause);
    const message =
      parserError instanceof Error
        ? parserError.message.replace(/^error:\s*/u, "")
        : "Invalid arguments.";
    return usageError(message);
  }

  return new CliError(
    "UNEXPECTED_ERROR",
    "The Work Graph CLI failed unexpectedly.",
    EXIT_CODES.transport,
    { cause },
  );
};

export const runCli = async (
  args: string[],
  dependencies: CliDependencies = {},
): Promise<ExitCode> => {
  const stdout =
    dependencies.stdout ?? ((text: string) => process.stdout.write(text));
  const stderr =
    dependencies.stderr ?? ((text: string) => process.stderr.write(text));

  const cli = createCli({
    router: workGraphRouter,
    context: createCommandContext({
      environment: dependencies.environment,
      fetch: dependencies.fetch,
      makeUuid: dependencies.makeUuid,
    }),
    name: "work-graph",
    version: "0.1.0",
    description: "Agent-friendly client for the Work Graph REST API",
    jsonInput: "auto",
  });
  const runParameters = {
    argv: args,
    prompts: false as const,
    process: { exit: () => undefined as never },
    logger: {
      info: (value: unknown) =>
        stdout(
          typeof value === "string" ? value : `${JSON.stringify(value)}\n`,
        ),
      error: () => undefined,
    },
  };
  const program = cli.buildProgram(runParameters) as Command;
  program.option(
    "--api-url <url>",
    globalOptionsSchema.shape.apiUrl.description ?? "API base URL",
  );
  program.option(
    "--cf-access-allowed-origin <origin>",
    globalOptionsSchema.shape.cfAccessAllowedOrigin.description ??
      "Exact trusted Access origin",
    collect,
    [],
  );

  try {
    await cli.run(runParameters, program);
    return EXIT_CODES.success;
  } catch (cause) {
    if (cause instanceof FailedToExitError && cause.exitCode === 0) {
      return EXIT_CODES.success;
    }
    const error = toCliError(cause);
    stderr(`${JSON.stringify(errorDocument(error))}\n`);
    return error.exitCode;
  }
};
