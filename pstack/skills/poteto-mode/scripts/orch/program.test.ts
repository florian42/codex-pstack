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

  it("refuses a second active code writer", () => {
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
    ).toThrow("integration writer already reserved by unit-a");
  });
});
