import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  applyEvent,
  initialProgram,
  parseEvent,
  type ProgramEvent,
  type ProgramView,
} from "./program.ts";

export type OrchestrateProfile = "codex-local-session" | "claude-local-session";

export interface JournalMetadata {
  readonly schema: 1;
  readonly profile: OrchestrateProfile;
  readonly repo: string;
  readonly program: string;
  readonly integrationWriter: string;
  readonly initialBranch: string;
  readonly initialHead: string;
  /** Concurrent `isolated-worktree` dispatch cap; `Infinity` means unbounded. */
  readonly maxCodeDispatches: number;
}

export interface InitializeJournalInput {
  readonly store: string;
  readonly repo: string;
  readonly program: string;
  readonly integrationWriter: string;
  readonly initialBranch: string;
  readonly initialHead: string;
  readonly profile?: OrchestrateProfile;
  readonly maxCodeDispatches?: number;
}

export function isProfile(value: string): value is OrchestrateProfile {
  return value === "codex-local-session" || value === "claude-local-session";
}

/** The cap a profile uses when `--max-code-dispatches` is not supplied. */
export function defaultMaxCodeDispatches(profile: OrchestrateProfile): number {
  return profile === "codex-local-session" ? 1 : Number.POSITIVE_INFINITY;
}

function parseMaxCodeDispatches(value: string): number {
  if (value === "unbounded") return Number.POSITIVE_INFINITY;
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error("maxCodeDispatches must be a positive integer or unbounded");
  }
  return Number(value);
}

function formatMaxCodeDispatches(value: number): string {
  return Number.isFinite(value) ? String(value) : "unbounded";
}

function serializeMetadata(
  metadata: JournalMetadata,
): Readonly<Record<string, string>> {
  return {
    schema: "1",
    profile: metadata.profile,
    repo: metadata.repo,
    program: metadata.program,
    integrationWriter: metadata.integrationWriter,
    initialBranch: metadata.initialBranch,
    initialHead: metadata.initialHead,
    maxCodeDispatches: formatMaxCodeDispatches(metadata.maxCodeDispatches),
  };
}

interface EventRow {
  readonly payload_json: string;
}

interface ArtifactRow {
  readonly body: Uint8Array;
}

interface MetadataRow {
  readonly key: string;
  readonly value: string;
}

function requireNonEmpty(name: string, value: string): string {
  if (value.trim().length === 0) throw new Error(`${name} must not be empty`);
  return value;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function schema(database: Database): void {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS artifacts (
      digest TEXT PRIMARY KEY,
      body BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      payload_json TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS events_no_update
      BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'events are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS events_no_delete
      BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'events are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS artifacts_no_update
      BEFORE UPDATE ON artifacts BEGIN SELECT RAISE(ABORT, 'artifacts are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS artifacts_no_delete
      BEFORE DELETE ON artifacts BEGIN SELECT RAISE(ABORT, 'artifacts are immutable'); END;
  `);
}

function readMetadata(database: Database): JournalMetadata {
  const rows = database
    .query<MetadataRow, []>("SELECT key, value FROM metadata ORDER BY key")
    .all();
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const schemaValue = values.get("schema");
  const profile = values.get("profile");
  const repo = values.get("repo");
  const program = values.get("program");
  const integrationWriter = values.get("integrationWriter");
  const initialBranch = values.get("initialBranch");
  const initialHead = values.get("initialHead");
  if (
    schemaValue !== "1" ||
    profile === undefined ||
    !isProfile(profile) ||
    repo === undefined ||
    program === undefined ||
    integrationWriter === undefined ||
    initialBranch === undefined ||
    initialHead === undefined
  ) {
    throw new Error("invalid Codex Orchestrate journal metadata");
  }
  // Journals written before the cap was recorded fall back to their profile's
  // default, so an existing store still replays.
  const maxCodeDispatches = parseMaxCodeDispatches(
    values.get("maxCodeDispatches") ??
      formatMaxCodeDispatches(defaultMaxCodeDispatches(profile)),
  );
  return {
    schema: 1,
    profile,
    repo,
    program,
    integrationWriter,
    initialBranch,
    initialHead,
    maxCodeDispatches,
  };
}

function replay(database: Database, maxCodeDispatches: number): ProgramView {
  let view = initialProgram(maxCodeDispatches);
  const rows = database
    .query<EventRow, []>("SELECT payload_json FROM events ORDER BY sequence")
    .all();
  for (const row of rows) {
    view = applyEvent(view, parseEvent(JSON.parse(row.payload_json)));
  }
  return view;
}

export interface Journal {
  readonly metadata: JournalMetadata;
  append(event: ProgramEvent, artifacts: readonly Uint8Array[]): ProgramView;
  artifact(digest: string): Uint8Array;
  recover(sessionId: string): readonly string[];
  view(): ProgramView;
  close(): void;
}

function journal(database: Database): Journal {
  const metadata = readMetadata(database);
  const replayProgram = (): ProgramView => replay(database, metadata.maxCodeDispatches);
  const appendTransaction = database.transaction(
    (event: ProgramEvent, artifacts: readonly Uint8Array[]): ProgramView => {
      const payload = JSON.stringify(event);
      const existing = database
        .query<EventRow, [string]>("SELECT payload_json FROM events WHERE event_id = ?")
        .get(event.id);
      if (existing !== null) {
        if (existing.payload_json !== payload) {
          throw new Error(`event ${event.id} already exists with different data`);
        }
        return replayProgram();
      }

      const next = applyEvent(replayProgram(), event);
      const insertArtifact = database.query(
        "INSERT OR IGNORE INTO artifacts(digest, body) VALUES (?, ?)",
      );
      for (const body of artifacts) insertArtifact.run(sha256(body), body);
      const referencedDigest = event.kind === "report-accepted"
        ? event.reportDigest
        : event.kind === "verification-recorded"
          ? event.receiptDigest
          : event.kind === "unit-planned"
            ? event.unit.briefDigest
          : undefined;
      if (referencedDigest !== undefined) {
        const referenced = database
          .query<{ readonly found: number }, [string]>(
            "SELECT 1 AS found FROM artifacts WHERE digest = ?",
          )
          .get(referencedDigest);
        if (referenced === null) {
          throw new Error(`event ${event.id} references missing artifact ${referencedDigest}`);
        }
      }
      database
        .query("INSERT INTO events(event_id, payload_json) VALUES (?, ?)")
        .run(event.id, payload);
      return next;
    },
  );

  const recoverTransaction = database.transaction((sessionId: string): readonly string[] => {
    requireNonEmpty("session", sessionId);
    let current = replayProgram();
    const interrupted: string[] = [];
    for (const unit of current.units.values()) {
      if (unit.state.kind !== "dispatched") continue;
      const event: ProgramEvent = {
        id: `recover:${sessionId}:${unit.spec.id}:${unit.state.attemptId}`,
        kind: "attempt-interrupted",
        unitId: unit.spec.id,
        attemptId: unit.state.attemptId,
      };
      const payload = JSON.stringify(event);
      const existing = database
        .query<EventRow, [string]>("SELECT payload_json FROM events WHERE event_id = ?")
        .get(event.id);
      if (existing === null) {
        current = applyEvent(current, event);
        database
          .query("INSERT INTO events(event_id, payload_json) VALUES (?, ?)")
          .run(event.id, payload);
      } else if (existing.payload_json !== payload) {
        throw new Error(`event ${event.id} already exists with different data`);
      }
      interrupted.push(unit.spec.id);
    }
    return interrupted;
  });

  return {
    metadata,
    append: (event, artifacts) => appendTransaction.immediate(event, artifacts),
    artifact: (digest) => {
      const row = database
        .query<ArtifactRow, [string]>("SELECT body FROM artifacts WHERE digest = ?")
        .get(digest);
      if (row === null) throw new Error(`unknown artifact ${digest}`);
      return row.body;
    },
    recover: (sessionId) => recoverTransaction.immediate(sessionId),
    view: () => replayProgram(),
    close: () => database.close(),
  };
}

export function initializeJournal(input: InitializeJournalInput): Journal {
  requireNonEmpty("store", input.store);
  requireNonEmpty("repo", input.repo);
  requireNonEmpty("program", input.program);
  requireNonEmpty("integration writer", input.integrationWriter);
  requireNonEmpty("initial branch", input.initialBranch);
  requireNonEmpty("initial head", input.initialHead);
  const profile: OrchestrateProfile = input.profile ?? "codex-local-session";
  const maxCodeDispatches = input.maxCodeDispatches ?? defaultMaxCodeDispatches(profile);
  if (maxCodeDispatches < 1 || (Number.isFinite(maxCodeDispatches) && !Number.isInteger(maxCodeDispatches))) {
    throw new Error("max code dispatches must be a positive integer or unbounded");
  }
  mkdirSync(dirname(input.store), { recursive: true });
  const database = new Database(input.store, { create: true, strict: true });
  schema(database);
  const expected = serializeMetadata({
    schema: 1,
    profile,
    repo: input.repo,
    program: input.program,
    integrationWriter: input.integrationWriter,
    initialBranch: input.initialBranch,
    initialHead: input.initialHead,
    maxCodeDispatches,
  });
  const initialize = database.transaction(() => {
    const count = database.query<{ readonly count: number }, []>("SELECT COUNT(*) AS count FROM metadata").get();
    if (count === null) throw new Error("could not inspect journal metadata");
    if (count.count === 0) {
      const insert = database.query("INSERT INTO metadata(key, value) VALUES (?, ?)");
      for (const [key, value] of Object.entries(expected)) insert.run(key, value);
      return;
    }
    const actual = serializeMetadata(readMetadata(database));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error("journal already belongs to a different program");
    }
  });
  try {
    initialize();
    return journal(database);
  } catch (error) {
    database.close();
    throw error;
  }
}

export function openJournal(store: string): Journal {
  const database = new Database(store, { strict: true });
  schema(database);
  try {
    return journal(database);
  } catch (error) {
    database.close();
    throw error;
  }
}
