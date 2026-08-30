### Orchestrate

Own the program, not its implementation. Use this route for work that outlives one worker and needs durable briefs, bounded parallelism, exact revision evidence, and one integration authority. If one agent can finish the work inside the current session, use figure-it-out instead. The store and recovery ceremony must earn their cost.

#### Runtime prerequisite

Bun is required. Before framing the program, run `command -v bun` and `bun --version`. If either command fails, stop before creating state or delegating work. Install the current stable release from the [official Bun installation guide](https://bun.com/docs/installation), then repeat both checks.

Read the active runtime's Orchestrate profile before continuing. The profile owns delegation, checkout isolation, persistence, recovery, monitoring, and integration mechanics. Follow only capabilities that profile actually provides.

- [Codex local-session profile](../../../references/runtime/orchestrate-codex.md)
- [Alternate runtime profile](../../../references/runtime/orchestrate-cursor.md)

Open a plan with the steps below copied verbatim. A skipped step stays visible with `skip: <reason>`.

#### Invariants

- The coordinator owns framing, briefs, state, recovery, and integration decisions. Workers own scoped artifacts.
- Every mutable checkout has one writer. The runtime profile must provide real isolation before parallel writers start.
- A completion is durable only after its report is stored. A code result also needs a full commit SHA from the program repository.
- Verification attaches to the exact commit SHA. A branch or pull request is discovery metadata, not evidence identity.
- One integration authority advances the shared checkout. It never repairs conflicts implicitly.
- Recovery trusts the program store and repository facts. It does not infer worker liveness from silence or private conversation state.

#### Brief contract

Every dispatch brief contains these fields. Collapse the format for cheap uniform work, but do not omit the facts.

```text
GOAL         One checkable outcome.
SCOPE        Writable and forbidden paths. Name the assigned checkout.
CONTEXT      Repository paths and accepted upstream reports.
ACCEPTANCE   Checkable criteria, one per line.
VERIFY       Exact commands or the live verification skill.
TIMEBOX      When to return partial findings and stop.
REPORT       Status, commands run, deviations, report path, and full commit SHA when code changed.
STANDING     Program constraints that every worker receives unchanged.
```

A dependency relays context, not only ordering. A downstream brief includes the accepted upstream report or an exact durable pointer to it. Missing scope, acceptance, verification, or report identity is a refuse-to-dispatch condition.

#### Steps

1. **Frame.** Write a countable done predicate, the expected units, the wall-clock budget, the integration authority, and the verification bar. Route smaller work to figure-it-out. Use arena for a contested decomposition.
2. **Initialize.** Run the profile's Bun preflight and initialize its durable store. Record standing orders before the first dispatch.
3. **Pilot.** Move one representative unit through plan, dispatch, report acceptance, exact-revision verification, and integration. Fix the brief and unit shape from observed failures.
4. **Scale.** Refill a bounded rolling window as units finish. Keep readers parallel. Start parallel writers only when the active profile provides disjoint checkouts. Pass accepted upstream reports into dependent briefs.
5. **Drain.** Record completions without reviewing them inline. At a safe boundary, accept durable reports, validate full commit SHAs, classify failures, and recompute ready work.
6. **Verify.** Use a different worker for independent verification when the unit warrants it. Record what actually ran against the exact commit. A changed commit invalidates the old receipt.
7. **Integrate.** Let only the named integration authority advance the shared checkout. Follow the profile's integration rule. A conflict becomes a new scoped unit.
8. **Recover.** On a new session or uncertain command result, run the profile's recovery operation before dispatching. Treat every previously active worker as unknown until durable artifacts prove a result.
9. **Close.** Reconcile every unit, verify the final repository state against the done predicate, preserve the decision trail, and leave the store intact for audit.

#### Reporting

At a checkpoint, report counts by legal state, accepted commit SHAs, verification receipts, open gates, and the next ready units. At close, report the final repository head, the done-predicate result, tests or live checks actually run, abandoned units, and remaining limits. Never report an unavailable monitor, scheduler, transcript, cloud worker, or delivery provider as if it ran.
