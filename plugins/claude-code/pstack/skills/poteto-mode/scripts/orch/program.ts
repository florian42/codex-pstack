export type Checkout =
  | { readonly kind: "shared-read-only" }
  | { readonly kind: "isolated-worktree"; readonly path: string };

export interface UnitSpec {
  readonly id: string;
  readonly checkout: Checkout;
  readonly briefDigest: string;
}

export type UnitState =
  | { readonly kind: "planned" }
  | { readonly kind: "dispatched"; readonly attemptId: string }
  | {
      readonly kind: "reported";
      readonly attemptId: string;
      readonly reportDigest: string;
      readonly commit?: string;
    }
  | {
      readonly kind: "verified";
      readonly commit: string;
      readonly reportDigest: string;
      readonly receiptDigest: string;
      readonly verdict: "passed";
    }
  | { readonly kind: "integrated"; readonly source: string; readonly head: string };

export interface UnitView {
  readonly spec: UnitSpec;
  readonly state: UnitState;
}

export interface ProgramView {
  readonly eventIds: ReadonlySet<string>;
  readonly units: ReadonlyMap<string, UnitView>;
  /**
   * How many `isolated-worktree` units may hold a dispatch at once. The
   * `codex-local-session` profile pins this to 1; `claude-local-session`
   * leaves it unbounded (`Number.POSITIVE_INFINITY`) or at an explicit cap,
   * because each of its code workers gets its own worktree. It never relaxes
   * the single integration writer, which is enforced outside the reducer.
   */
  readonly maxConcurrentCodeDispatches: number;
  readonly integrationHead?: string;
}

export type ProgramEvent =
  | { readonly id: string; readonly kind: "unit-planned"; readonly unit: UnitSpec }
  | {
      readonly id: string;
      readonly kind: "unit-dispatched";
      readonly unitId: string;
      readonly attemptId: string;
    }
  | {
      readonly id: string;
      readonly kind: "report-accepted";
      readonly unitId: string;
      readonly attemptId: string;
      readonly reportDigest: string;
      readonly commit?: string;
    }
  | {
      readonly id: string;
      readonly kind: "verification-recorded";
      readonly unitId: string;
      readonly commit: string;
      readonly receiptDigest: string;
      readonly verdict: "passed";
    }
  | {
      readonly id: string;
      readonly kind: "unit-integrated";
      readonly unitId: string;
      readonly source: string;
      readonly head: string;
    }
  | {
      readonly id: string;
      readonly kind: "attempt-interrupted";
      readonly unitId: string;
      readonly attemptId: string;
    };

export function initialProgram(
  maxConcurrentCodeDispatches: number = 1,
): ProgramView {
  if (maxConcurrentCodeDispatches < 1) {
    throw new Error("maxConcurrentCodeDispatches must be at least 1");
  }
  return { eventIds: new Set(), units: new Map(), maxConcurrentCodeDispatches };
}

function stateName(state: UnitState): string {
  return state.kind;
}

function requireUnit(program: ProgramView, unitId: string): UnitView {
  const unit = program.units.get(unitId);
  if (unit === undefined) throw new Error(`unknown unit ${unitId}`);
  return unit;
}

function replaceUnit(
  program: ProgramView,
  eventId: string,
  unit: UnitView,
): ProgramView {
  const units = new Map(program.units);
  units.set(unit.spec.id, unit);
  const eventIds = new Set(program.eventIds);
  eventIds.add(eventId);
  return {
    units,
    eventIds,
    maxConcurrentCodeDispatches: program.maxConcurrentCodeDispatches,
    ...(program.integrationHead === undefined ? {} : { integrationHead: program.integrationHead }),
  };
}

export function applyEvent(program: ProgramView, event: ProgramEvent): ProgramView {
  if (program.eventIds.has(event.id)) return program;

  switch (event.kind) {
    case "unit-planned": {
      const existing = program.units.get(event.unit.id);
      if (existing !== undefined) throw new Error(`unit ${event.unit.id} already exists`);
      return replaceUnit(program, event.id, {
        spec: event.unit,
        state: { kind: "planned" },
      });
    }
    case "unit-dispatched": {
      const unit = requireUnit(program, event.unitId);
      if (unit.state.kind !== "planned") {
        throw new Error(`cannot dispatch ${event.unitId} from ${stateName(unit.state)}`);
      }
      if (unit.spec.checkout.kind === "isolated-worktree") {
        const active = [...program.units.values()].filter(
          (candidate) =>
            candidate.spec.checkout.kind === "isolated-worktree" &&
            candidate.state.kind === "dispatched",
        );
        if (active.length >= program.maxConcurrentCodeDispatches) {
          const names = active.map((candidate) => candidate.spec.id).join(", ");
          const verb = active.length === 1 ? "is" : "are";
          throw new Error(
            `code dispatch limit reached: ${names} ${verb} already dispatched ` +
              `(limit ${program.maxConcurrentCodeDispatches})`,
          );
        }
      }
      return replaceUnit(program, event.id, {
        spec: unit.spec,
        state: { kind: "dispatched", attemptId: event.attemptId },
      });
    }
    case "report-accepted": {
      const unit = requireUnit(program, event.unitId);
      if (
        unit.state.kind !== "dispatched" ||
        unit.state.attemptId !== event.attemptId
      ) {
        throw new Error(`cannot accept report for ${event.unitId} from ${stateName(unit.state)}`);
      }
      return replaceUnit(program, event.id, {
        spec: unit.spec,
        state: {
          kind: "reported",
          attemptId: event.attemptId,
          reportDigest: event.reportDigest,
          ...(event.commit === undefined ? {} : { commit: event.commit }),
        },
      });
    }
    case "verification-recorded": {
      const unit = requireUnit(program, event.unitId);
      if (unit.state.kind !== "reported") {
        throw new Error(`cannot record verification for ${event.unitId} from ${stateName(unit.state)}`);
      }
      if (unit.state.commit === undefined) {
        throw new Error(`unit ${event.unitId} has no commit to verify`);
      }
      if (unit.state.commit !== event.commit) {
        throw new Error(`verification commit does not match ${event.unitId} report`);
      }
      return replaceUnit(program, event.id, {
        spec: unit.spec,
        state: {
          kind: "verified",
          commit: event.commit,
          reportDigest: unit.state.reportDigest,
          receiptDigest: event.receiptDigest,
          verdict: event.verdict,
        },
      });
    }
    case "unit-integrated": {
      const unit = requireUnit(program, event.unitId);
      if (unit.state.kind !== "verified") {
        throw new Error(`cannot integrate ${event.unitId} from ${stateName(unit.state)}`);
      }
      if (unit.state.commit !== event.source) {
        throw new Error(`integration source does not match ${event.unitId} verification`);
      }
      const next = replaceUnit(program, event.id, {
        spec: unit.spec,
        state: { kind: "integrated", source: event.source, head: event.head },
      });
      return { ...next, integrationHead: event.head };
    }
    case "attempt-interrupted": {
      const unit = requireUnit(program, event.unitId);
      if (
        unit.state.kind !== "dispatched" ||
        unit.state.attemptId !== event.attemptId
      ) {
        throw new Error(`cannot interrupt ${event.unitId} from ${stateName(unit.state)}`);
      }
      return replaceUnit(program, event.id, {
        spec: unit.spec,
        state: { kind: "planned" },
      });
    }
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Readonly<Record<string, unknown>>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`event ${field} must be a non-empty string`);
  }
  return value;
}

function shaField(record: Readonly<Record<string, unknown>>, field: string): string {
  const value = stringField(record, field);
  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(`event ${field} must be a full lowercase commit SHA`);
  }
  return value;
}

export function parseEvent(value: unknown): ProgramEvent {
  if (!isRecord(value)) throw new Error("event must be an object");
  const id = stringField(value, "id");
  const kind = stringField(value, "kind");
  switch (kind) {
    case "unit-planned": {
      const rawUnit = value.unit;
      if (!isRecord(rawUnit)) throw new Error("event unit must be an object");
      const rawCheckout = rawUnit.checkout;
      if (!isRecord(rawCheckout)) throw new Error("unit checkout must be an object");
      const checkoutKind = stringField(rawCheckout, "kind");
      const checkout: Checkout = checkoutKind === "shared-read-only"
        ? { kind: "shared-read-only" }
        : checkoutKind === "isolated-worktree"
          ? { kind: "isolated-worktree", path: stringField(rawCheckout, "path") }
          : (() => { throw new Error(`unknown checkout kind ${checkoutKind}`); })();
      return {
        id,
        kind,
        unit: {
          id: stringField(rawUnit, "id"),
          checkout,
          briefDigest: stringField(rawUnit, "briefDigest"),
        },
      };
    }
    case "unit-dispatched":
      return { id, kind, unitId: stringField(value, "unitId"), attemptId: stringField(value, "attemptId") };
    case "report-accepted": {
      const commit = value.commit;
      if (commit !== undefined && (typeof commit !== "string" || !/^[0-9a-f]{40}$/.test(commit))) {
        throw new Error("event commit must be a full lowercase commit SHA");
      }
      return {
        id,
        kind,
        unitId: stringField(value, "unitId"),
        attemptId: stringField(value, "attemptId"),
        reportDigest: stringField(value, "reportDigest"),
        ...(commit === undefined ? {} : { commit }),
      };
    }
    case "verification-recorded": {
      if (value.verdict !== "passed") throw new Error("event verdict must be passed");
      return {
        id,
        kind,
        unitId: stringField(value, "unitId"),
        commit: shaField(value, "commit"),
        receiptDigest: stringField(value, "receiptDigest"),
        verdict: "passed",
      };
    }
    case "unit-integrated":
      return { id, kind, unitId: stringField(value, "unitId"), source: shaField(value, "source"), head: shaField(value, "head") };
    case "attempt-interrupted":
      return { id, kind, unitId: stringField(value, "unitId"), attemptId: stringField(value, "attemptId") };
    default:
      throw new Error(`unknown event kind ${kind}`);
  }
}
