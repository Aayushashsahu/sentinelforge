import { describe, expect, it } from "vitest";
import { canCreateExternalAction, mayDecideApproval, nextMissionStatusForDecision } from "./approval";
import { runFixtureVerification } from "./fixture";
import { assertAllowedMissionTransition, isAllowedMissionTransition } from "./transitions";
import { createImmutableAuditEvent, nextAuditSequence } from "./audit";
import { resolvePersistedApproval, type ApprovalWorkflowPort } from "./approvalWorkflow";

describe("fixture verifier", () => {
  it("validates the minimal fixture repair without shell execution", async () => { const run = await runFixtureVerification(); expect(run.result.status).toBe("PASS"); expect(run.exitCode).toBe(0); expect(run.stdout).toContain("PASS"); });
  it("captures a verification failure", async () => { const run = await runFixtureVerification({ forceFailure: true }); expect(run.result.status).toBe("FAIL"); expect(run.exitCode).toBe(1); expect(run.stderr).toContain("AssertionError"); });
  it("fails closed when verification exceeds its bound", async () => { const run = await runFixtureVerification({ forceTimeout: true }); expect(run.result.status).toBe("TIMEOUT"); expect(run.timedOut).toBe(true); expect(run.exitCode).toBe(124); });
});
describe("approval policy", () => {
  it("accepts only a fresh pending approval for a waiting mission", () => { expect(mayDecideApproval("WAITING_APPROVAL", "PENDING", Date.now() + 1000)).toBe(true); expect(mayDecideApproval("VERIFYING", "PENDING", Date.now() + 1000)).toBe(false); expect(mayDecideApproval("WAITING_APPROVAL", "APPROVED", Date.now() + 1000)).toBe(false); expect(mayDecideApproval("WAITING_APPROVAL", "PENDING", Date.now() - 1)).toBe(false); });
  it("rejecting keeps the mission outside execution", () => { expect(nextMissionStatusForDecision(false)).toBe("REJECTED"); });
  it("prevents unauthorized and duplicate external actions", () => { expect(canCreateExternalAction(0, "APPROVED", "EXECUTING")).toBe(true); expect(canCreateExternalAction(1, "APPROVED", "EXECUTING")).toBe(false); expect(canCreateExternalAction(0, "REJECTED", "EXECUTING")).toBe(false); expect(canCreateExternalAction(0, "APPROVED", "WAITING_APPROVAL")).toBe(false); });
});

describe("mission transition guard", () => {
  it("accepts only the bounded workflow path", () => {
    expect(isAllowedMissionTransition("CREATED", "INVESTIGATING")).toBe(true);
    expect(isAllowedMissionTransition("CREATED", "FAILED")).toBe(true);
    expect(isAllowedMissionTransition("WAITING_APPROVAL", "EXECUTING")).toBe(true);
    expect(isAllowedMissionTransition("WAITING_APPROVAL", "REJECTED")).toBe(true);
  });

  it("fails closed for bypass attempts and immutable terminal missions", () => {
    expect(() => assertAllowedMissionTransition("CREATED", "COMPLETED")).toThrow("Mission transition refused");
    expect(() => assertAllowedMissionTransition("REJECTED", "EXECUTING")).toThrow("Mission transition refused");
    expect(() => assertAllowedMissionTransition("COMPLETED", "INVESTIGATING")).toThrow("Mission transition refused");
  });
});

describe("append-only audit events", () => {
  it("freezes a recorded event and allocates the next sequence without replacing prior records", () => {
    const prior = createImmutableAuditEvent({ id: "evt_1", sequence: 1, result: "mission created" });
    const appended = createImmutableAuditEvent({ id: "evt_2", sequence: nextAuditSequence([prior.sequence]), result: "approval required" });
    expect(Object.isFrozen(prior)).toBe(true);
    expect(prior.result).toBe("mission created");
    expect(appended.sequence).toBe(2);
    expect([prior, appended]).toHaveLength(2);
    expect(() => { (prior as { result: string }).result = "tampered"; }).toThrow();
  });
});

describe("persisted approval rejection", () => {
  it("persists REJECTED, appends the decision event, and creates no external action", async () => {
    const mission = { id: "SF_test", status: "WAITING_APPROVAL" as const, repository: "sentinelforge-demo/workflow-compatibility-fixture" };
    const approval = { id: "apr_test", status: "PENDING" as const, expiresAt: Date.now() + 60_000 };
    const events: string[] = [];
    const actions: string[] = [];
    const port: ApprovalWorkflowPort<{ mission: typeof mission; events: string[]; actions: string[] }> = {
      getApprovalWithMission: async () => ({ approval, mission }),
      decideApproval: async (_requestId, status) => { approval.status = status; },
      setMissionStatus: async (_missionId, status) => { mission.status = status; },
      appendMissionEvent: async event => { events.push(event.eventType); },
      countExternalActions: async () => actions.length,
      createSimulatedExternalAction: async input => { actions.push(input.target); return { id: "act_test", result: "should not execute" }; },
      getMissionBundle: async () => ({ mission, events, actions }),
    };
    const result = await resolvePersistedApproval(port, approval.id, false);
    expect(approval.status).toBe("REJECTED");
    expect(result.mission.status).toBe("REJECTED");
    expect(result.events).toEqual(["APPROVAL_REJECTED"]);
    expect(result.actions).toEqual([]);
  });

  it("uses the approved mission repository as the simulated-action target", async () => {
    const mission = { id: "SF_workflow", status: "WAITING_APPROVAL" as const, repository: "sentinelforge-demo/workflow-compatibility-fixture" };
    const approval = { id: "apr_workflow", status: "PENDING" as const, expiresAt: Date.now() + 60_000 };
    let actionTarget = "";
    const port: ApprovalWorkflowPort<{ mission: typeof mission }> = {
      getApprovalWithMission: async () => ({ approval, mission }),
      decideApproval: async (_requestId, status) => { approval.status = status; },
      setMissionStatus: async (_missionId, status) => { mission.status = status; },
      appendMissionEvent: async () => undefined,
      countExternalActions: async () => 0,
      createSimulatedExternalAction: async input => { actionTarget = input.target; return { id: "act_workflow", result: "simulated" }; },
      getMissionBundle: async () => ({ mission }),
    };
    await resolvePersistedApproval(port, approval.id, true);
    expect(actionTarget).toBe("sentinelforge-demo/workflow-compatibility-fixture");
  });
});
