import { setTimeout as delay } from "node:timers/promises";
import { parseArgs as parseArgvTokens } from "node:util";
import {
  GhGitHubReader,
  WatcherQueryError,
  discoverStack,
  resolveContext,
} from "./github.ts";
import {
  runQueued,
  runSimple,
  statusQueryVerdict,
  verdictFactory,
  type WatchClock,
} from "./policy.ts";
import { renderJson, renderPretty } from "./render.ts";
import type * as T from "./types.ts";
import { nonEmpty, parsePrNumber } from "./types.ts";
export interface CliOptions {
  readonly owner: string | null;
  readonly repo: string | null;
  readonly pr: T.PrNumber | null;
  readonly mode: T.WatchMode;
  readonly stackPrs: readonly T.PrNumber[];
  readonly statusOnly: boolean;
  readonly pretty: boolean;
  readonly polling: T.PollingOptions;
}
/** Thrown after usage output has been written; carries the process exit code. */
export class CliExit extends Error {
  constructor(readonly exitCode: number) {
    super(`cli exit ${exitCode}`);
    this.name = "CliExit";
  }
}
/** Raised by an option value parser; the caller adds the option context. */
class InvalidArgumentError extends Error {}
/** Raised for any other usage failure; the message is already complete. */
class UsageError extends Error {}
/** Raised when `-h`/`--help` is seen; the help text is printed and 0 returned. */
class HelpRequested extends Error {}
const DESCRIPTION =
  "Watch one pull request, a connected stack, or an immutable queued stack.\nJSON (NDJSON while polling) is the default; --pretty renders human text.";
const HELP = `Usage: watch-pr [options]

${DESCRIPTION}

Options:
  --owner <owner>             GitHub repository owner
  --repo <repo>               GitHub repository name
  --pr <number>               pull request number
  --stack                     watch the connected open stack (default: false)
  --queued-stack              watch the captured stack until all PRs merge
                              (default: false)
  --stack-prs <n,...>         frozen bottom-to-top queue (queued mode only)
  --interval <seconds>        poll interval (default: 60)
  --sweep-interval <seconds>  whole-stack sweep interval (default: 300)
  --timeout <seconds>         deadline; 0 disables it (default: 0)
  --max-query-errors <count>  consecutive query-error budget (default: 5)
  --status-only               print one status table and exit 0 (default: false)
  --allow-draft               do not treat a draft as a merge gate (default:
                              false)
  --pretty                    render human text instead of JSON (default: false)
  -h, --help                  display help for command
`;
/** Long option name -> the flag spec quoted in argument-error messages. */
const FLAG_SPEC = {
  owner: "--owner <owner>",
  repo: "--repo <repo>",
  pr: "--pr <number>",
  stack: "--stack",
  "queued-stack": "--queued-stack",
  "stack-prs": "--stack-prs <n,...>",
  interval: "--interval <seconds>",
  "sweep-interval": "--sweep-interval <seconds>",
  timeout: "--timeout <seconds>",
  "max-query-errors": "--max-query-errors <count>",
  "status-only": "--status-only",
  "allow-draft": "--allow-draft",
  pretty: "--pretty",
  help: "-h, --help",
} as const;
type LongName = keyof typeof FLAG_SPEC;
const VALUE_OPTIONS = [
  "owner",
  "repo",
  "pr",
  "stack-prs",
  "interval",
  "sweep-interval",
  "timeout",
  "max-query-errors",
] as const satisfies readonly LongName[];
/**
 * The boolean flags. `parseArgs` runs non-strict so that an unknown option can
 * be reported with our own wording, but non-strict mode also stores the string
 * from `--stack=true` on a boolean option instead of rejecting it, which would
 * silently read back as "not set". These names are checked for an attached
 * value and refused as usage errors.
 */
const BOOLEAN_OPTIONS = [
  "stack",
  "queued-stack",
  "status-only",
  "allow-draft",
  "pretty",
  "help",
] as const satisfies readonly LongName[];
function positiveNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new InvalidArgumentError("must be greater than zero");
  return parsed;
}
function nonNegativeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new InvalidArgumentError("must be zero or greater");
  return parsed;
}
function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new InvalidArgumentError("must be a positive integer");
  return parsed;
}
function prNumber(value: string): T.PrNumber {
  try {
    return parsePrNumber(Number(value.replace(/^#/, "")));
  } catch {
    throw new InvalidArgumentError("must be a positive integer");
  }
}
function stackPrList(value: string): T.NonEmpty<T.PrNumber> {
  const numbers = value.split(",").map((part) => prNumber(part.trim()));
  if (new Set(numbers).size !== numbers.length)
    throw new InvalidArgumentError("contains a duplicate PR");
  const parsed = nonEmpty(numbers);
  if (parsed === null) throw new InvalidArgumentError("cannot be empty");
  return parsed;
}
/**
 * Rewrite `--opt value` into `--opt=value` for the value-taking options, so
 * that a value which itself looks like a flag (`-1`) is still consumed as the
 * value rather than rejected by the standard parser.
 */
function attachOptionValues(argv: readonly string[]): string[] {
  const attached: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] as string;
    const name = token.startsWith("--") ? token.slice(2) : "";
    if (!(VALUE_OPTIONS as readonly string[]).includes(name)) {
      attached.push(token);
      continue;
    }
    if (index + 1 >= argv.length)
      throw new UsageError(
        `option '${FLAG_SPEC[name as LongName]}' argument missing`
      );
    attached.push(`${token}=${argv[index + 1] as string}`);
    index += 1;
  }
  return attached;
}
/** Apply one option's value parser, wrapping failures in the usage message. */
function coerce<Value>(
  name: LongName,
  raw: string,
  parse: (value: string) => Value
): Value {
  try {
    return parse(raw);
  } catch (error) {
    if (!(error instanceof InvalidArgumentError)) throw error;
    throw new UsageError(
      `option '${FLAG_SPEC[name]}' argument '${raw}' is invalid. ${error.message}`
    );
  }
}
interface RawOptions {
  readonly owner?: string;
  readonly repo?: string;
  readonly pr?: T.PrNumber;
  readonly stack: boolean;
  readonly queuedStack: boolean;
  readonly stackPrs?: T.NonEmpty<T.PrNumber>;
  readonly interval: number;
  readonly sweepInterval: number;
  readonly timeout: number;
  readonly maxQueryErrors: number;
  readonly statusOnly: boolean;
  readonly allowDraft: boolean;
  readonly pretty: boolean;
}
/**
 * Parse the argument vector. Usage failures write to `io` and throw `CliExit`;
 * `--help` writes the help text to stdout and throws `CliExit(0)`.
 */
export function parseArgs(
  argv: readonly string[],
  io: Pick<CliRuntime, "stdout" | "stderr">
): CliOptions {
  try {
    return parseChecked(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      io.stdout(HELP);
      throw new CliExit(0);
    }
    if (!(error instanceof UsageError)) throw error;
    io.stderr(`error: ${error.message}\n`);
    throw new CliExit(64);
  }
}
function parseChecked(argv: readonly string[]): CliOptions {
  const { values, tokens } = parseArgvTokens({
    args: attachOptionValues(argv),
    strict: false,
    allowPositionals: true,
    tokens: true,
    options: {
      owner: { type: "string" },
      repo: { type: "string" },
      pr: { type: "string" },
      stack: { type: "boolean" },
      "queued-stack": { type: "boolean" },
      "stack-prs": { type: "string" },
      interval: { type: "string" },
      "sweep-interval": { type: "string" },
      timeout: { type: "string" },
      "max-query-errors": { type: "string" },
      "status-only": { type: "boolean" },
      "allow-draft": { type: "boolean" },
      pretty: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  let positionals = 0;
  for (const token of tokens) {
    if (token.kind === "positional") positionals += 1;
    if (token.kind !== "option") continue;
    if (!(token.name in FLAG_SPEC))
      throw new UsageError(`unknown option '${token.rawName}'`);
    if (
      (BOOLEAN_OPTIONS as readonly string[]).includes(token.name) &&
      token.value !== undefined
    )
      throw new UsageError(
        `option '${FLAG_SPEC[token.name as LongName]}' does not take a value`
      );
    if (token.name === "help") throw new HelpRequested();
  }
  if (positionals > 0)
    throw new UsageError(
      `too many arguments. Expected 0 arguments but got ${positionals}.`
    );
  const text = (name: LongName): string | undefined => {
    const value = values[name];
    return typeof value === "string" ? value : undefined;
  };
  const flag = (name: LongName): boolean => values[name] === true;
  const raw: RawOptions = {
    ...(text("owner") === undefined ? {} : { owner: text("owner") as string }),
    ...(text("repo") === undefined ? {} : { repo: text("repo") as string }),
    ...(text("pr") === undefined
      ? {}
      : { pr: coerce("pr", text("pr") as string, prNumber) }),
    stack: flag("stack"),
    queuedStack: flag("queued-stack"),
    ...(text("stack-prs") === undefined
      ? {}
      : {
          stackPrs: coerce(
            "stack-prs",
            text("stack-prs") as string,
            stackPrList
          ),
        }),
    interval:
      text("interval") === undefined
        ? 60
        : coerce("interval", text("interval") as string, positiveNumber),
    sweepInterval:
      text("sweep-interval") === undefined
        ? 300
        : coerce(
            "sweep-interval",
            text("sweep-interval") as string,
            positiveNumber
          ),
    timeout:
      text("timeout") === undefined
        ? 0
        : coerce("timeout", text("timeout") as string, nonNegativeNumber),
    maxQueryErrors:
      text("max-query-errors") === undefined
        ? 5
        : coerce(
            "max-query-errors",
            text("max-query-errors") as string,
            positiveInteger
          ),
    statusOnly: flag("status-only"),
    allowDraft: flag("allow-draft"),
    pretty: flag("pretty"),
  };
  if (raw.stack && raw.queuedStack)
    throw new UsageError(
      "option '--stack' cannot be used with option '--queued-stack'"
    );
  if (raw.stackPrs !== undefined && !raw.queuedStack)
    throw new UsageError("--stack-prs requires --queued-stack");
  return {
    owner: raw.owner ?? null,
    repo: raw.repo ?? null,
    pr: raw.pr ?? null,
    mode: raw.queuedStack ? "queued-stack" : raw.stack ? "stack" : "single",
    stackPrs: raw.stackPrs ?? [],
    statusOnly: raw.statusOnly,
    pretty: raw.pretty,
    polling: {
      interval: raw.interval,
      sweepInterval: raw.sweepInterval,
      timeout: raw.timeout,
      maxQueryErrors: raw.maxQueryErrors,
      allowDraft: raw.allowDraft,
    },
  };
}
export interface CliRuntime {
  readonly reader: T.GitHubReader;
  readonly clock: WatchClock;
  readonly stdout: (value: string) => void;
  readonly stderr: (value: string) => void;
}
function realRuntime(): CliRuntime {
  return {
    reader: new GhGitHubReader(),
    clock: {
      now: () => performance.now() / 1_000,
      observedAt: () => new Date().toISOString(),
      sleep: async (seconds) => {
        await delay(seconds * 1_000);
      },
    },
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  };
}
export async function main(
  argv: readonly string[],
  runtime: CliRuntime = realRuntime()
): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv, runtime);
  } catch (error) {
    if (!(error instanceof CliExit)) throw error;
    return error.exitCode === 0 ? 0 : 64;
  }
  const render = options.pretty ? renderPretty : renderJson;
  const emit = (verdict: T.ProgressVerdict): void =>
    runtime.stdout(render(verdict));
  let contexts: T.NonEmpty<T.PrContext>;
  try {
    const seed = await resolveContext({
      reader: runtime.reader,
      owner: options.owner,
      repo: options.repo,
      pr: options.pr ?? options.stackPrs[0] ?? null,
    });
    contexts =
      nonEmpty(options.stackPrs.map((number) => ({ ...seed, number }))) ??
      (options.mode === "single"
        ? [seed]
        : await discoverStack(runtime.reader, seed));
  } catch (error) {
    if (!(error instanceof WatcherQueryError)) throw error;
    const verdict = statusQueryVerdict(
      verdictFactory(runtime.clock, options.mode),
      1,
      error.failure
    );
    runtime.stdout(render(verdict));
    return verdict.exitCode;
  }
  const dependencies = { reader: runtime.reader, clock: runtime.clock, emit };
  const verdict =
    options.mode === "queued-stack" && !options.statusOnly
      ? await runQueued({ dependencies, contexts, options: options.polling })
      : await runSimple({
          dependencies,
          contexts,
          mode: options.mode,
          statusOnly: options.statusOnly,
          options: options.polling,
        });
  runtime.stdout(render(verdict));
  return verdict.exitCode;
}
