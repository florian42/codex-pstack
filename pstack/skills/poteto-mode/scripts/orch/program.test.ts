import { describe, expect, it } from "bun:test";
import {
  applyEvent,
  initialProgram,
  type ProgramEvent,
} from "./program.ts";

const planned: ProgramEvent = {
  id: "event-plan-a",
  kind: "unit-planned",
  unit: {
    id: "unit-a",
    checkout: { kind: "isolated-worktree", path: "/tmp/unit-a" },
    briefDigest: "brief-a",
  },
};

const plannedB: ProgramEvent = {
  id: "event-plan-b",
  kind: "unit-planned",
  unit: {
    id: "unit-b",
    checkout: { kind: "isolated-worktree", path: "/tmp/unit-b" },
    briefDigest: "brief-b",
  },
};

const dispatchA: ProgramEvent = {
  id: "event-dispatch-a",
  kind: "unit-dispatched",
  unitId: "unit-a",
  attemptId: "attempt-a",
};

const dispatchB: ProgramEvent = {
  id: "event-dispatch-b",
  kind: "unit-dispatched",
  unitId: "unit-b",
  attemptId: "attempt-b",
};

describe("Codex Orchestrate state machine", () => {
  it("accepts the legal plan to dispatch to report to verify to integrate path", () => {
    let program = initialProgram();
    program = applyEvent(program, planned);
    program = applyEvent(program, {
      id: "event-dispatch-a",
      kind: "unit-dispatched",
      unitId: "unit-a",
      attemptId: "attempt-a",
    });
    program = applyEvent(program, {
      id: "event-report-a",
      kind: "report-accepted",
      unitId: "unit-a",
      attemptId: "attempt-a",
      reportDigest: "digest-report",
      commit: "1111111111111111111111111111111111111111",
    });
    program = applyEvent(program, {
      id: "event-verify-a",
      kind: "verification-recorded",
      unitId: "unit-a",
      commit: "1111111111111111111111111111111111111111",
      receiptDigest: "digest-receipt",
      verdict: "passed",
    });
    program = applyEvent(program, {
      id: "event-integrate-a",
      kind: "unit-integrated",
      unitId: "unit-a",
      source: "1111111111111111111111111111111111111111",
      head: "2222222222222222222222222222222222222222",
    });

    expect(program.units.get("unit-a")?.state).toEqual({
      kind: "integrated",
      source: "1111111111111111111111111111111111111111",
      head: "2222222222222222222222222222222222222222",
    });
  });

  it("rejects an illegal verification before a report", () => {
    const program = applyEvent(initialProgram(), planned);

    expect(() =>
      applyEvent(program, {
        id: "event-verify-early",
        kind: "verification-recorded",
        unitId: "unit-a",
        commit: "1111111111111111111111111111111111111111",
        receiptDigest: "digest-receipt",
        verdict: "passed",
      })
    ).toThrow("cannot record verification for unit-a from planned");
  });

  it("makes duplicate event delivery idempotent", () => {
    const once = applyEvent(initialProgram(), planned);
    const twice = applyEvent(once, planned);

    expect(twice).toBe(once);
  });

  it("returns an interrupted dispatch to planned on recovery", () => {
    let program = applyEvent(initialProgram(), planned);
    program = applyEvent(program, {
      id: "event-dispatch-a",
      kind: "unit-dispatched",
      unitId: "unit-a",
      attemptId: "attempt-a",
    });
    program = applyEvent(program, {
      id: "event-interrupt-a",
      kind: "attempt-interrupted",
      unitId: "unit-a",
      attemptId: "attempt-a",
    });

    expect(program.units.get("unit-a")?.state).toEqual({ kind: "planned" });
  });

  it("refuses a second code dispatch under the default limit of one", () => {
    let program = applyEvent(initialProgram(), planned);
    program = applyEvent(program, {
      id: "event-plan-b",
      kind: "unit-planned",
      unit: {
        id: "unit-b",
        checkout: { kind: "isolated-worktree", path: "/tmp/unit-b" },
        briefDigest: "brief-b",
      },
    });
    program = applyEvent(program, {
      id: "event-dispatch-a",
      kind: "unit-dispatched",
      unitId: "unit-a",
      attemptId: "attempt-a",
    });

    expect(() =>
      applyEvent(program, {
        id: "event-dispatch-b",
        kind: "unit-dispatched",
        unitId: "unit-b",
        attemptId: "attempt-b",
      })
    ).toThrow("code dispatch limit reached: unit-a is already dispatched (limit 1)");
  });

  it("allows two concurrent code dispatches when the limit is two", () => {
    let program = applyEvent(initialProgram(2), planned);
    program = applyEvent(program, plannedB);
    program = applyEvent(program, dispatchA);
    program = applyEvent(program, dispatchB);

    expect(program.units.get("unit-a")?.state.kind).toBe("dispatched");
    expect(program.units.get("unit-b")?.state.kind).toBe("dispatched");
  });

  it("still refuses a third code dispatch when the limit is two", () => {
    let program = applyEvent(initialProgram(2), planned);
    program = applyEvent(program, plannedB);
    program = applyEvent(program, {
      id: "event-plan-c",
      kind: "unit-planned",
      unit: {
        id: "unit-c",
        checkout: { kind: "isolated-worktree", path: "/tmp/unit-c" },
        briefDigest: "brief-c",
      },
    });
    program = applyEvent(program, dispatchA);
    program = applyEvent(program, dispatchB);

    expect(() =>
      applyEvent(program, {
        id: "event-dispatch-c",
        kind: "unit-dispatched",
        unitId: "unit-c",
        attemptId: "attempt-c",
      })
    ).toThrow("code dispatch limit reached: unit-a, unit-b are already dispatched (limit 2)");
  });

  it("never lets a raised limit widen read-only or integration behaviour", () => {
    let program = applyEvent(initialProgram(2), planned);
    program = applyEvent(program, plannedB);
    program = applyEvent(program, dispatchA);
    program = applyEvent(program, dispatchB);
    for (const id of ["unit-a", "unit-b"] as const) {
      const commit = id === "unit-a"
        ? "1111111111111111111111111111111111111111"
        : "3333333333333333333333333333333333333333";
      program = applyEvent(program, {
        id: `event-report-${id}`,
        kind: "report-accepted",
        unitId: id,
        attemptId: id === "unit-a" ? "attempt-a" : "attempt-b",
        reportDigest: `digest-${id}`,
        commit,
      });
      program = applyEvent(program, {
        id: `event-verify-${id}`,
        kind: "verification-recorded",
        unitId: id,
        commit,
        receiptDigest: `receipt-${id}`,
        verdict: "passed",
      });
    }
    program = applyEvent(program, {
      id: "event-integrate-a",
      kind: "unit-integrated",
      unitId: "unit-a",
      source: "1111111111111111111111111111111111111111",
      head: "2222222222222222222222222222222222222222",
    });
    program = applyEvent(program, {
      id: "event-integrate-b",
      kind: "unit-integrated",
      unitId: "unit-b",
      source: "3333333333333333333333333333333333333333",
      head: "4444444444444444444444444444444444444444",
    });

    // Integration stays serial: the head advances one unit at a time.
    expect(program.integrationHead).toBe("4444444444444444444444444444444444444444");
    expect(program.maxConcurrentCodeDispatches).toBe(2);
  });
});
