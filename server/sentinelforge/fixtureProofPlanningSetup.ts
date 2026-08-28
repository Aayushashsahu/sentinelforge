import { assertCanonicalFixtureProofPatch } from "./fixtureGithubProof";

export type FixtureProofPlanningMission = {
  id: string;
  status: "CREATED" | "INVESTIGATING" | "PLANNING_FIX" | "VERIFYING" | "WAITING_APPROVAL" | "EXECUTING" | "COMPLETED" | "FAILED" | "REJECTED";
  repository: string;
  rootCause: string | null;
  repairSummary: string | null;
  patch: string | null;
};

export type FixtureProofPlanningSetupPort = {
  getMission(missionId: string): Promise<FixtureProofPlanningMission | null>;
  setMissionStatus(missionId: string, status: "INVESTIGATING" | "PLANNING_FIX", updates?: { rootCause?: string; repairSummary?: string; patch?: string }): Promise<void>;
  appendAudit(input: { missionId: string; eventType: string; result: string; payload: Record<string, unknown> }): Promise<void>;
  setMissionStatusAndAudit?(missionId: string, status: "INVESTIGATING" | "PLANNING_FIX", audit: { eventType: string; actor: string; result: string; payload?: unknown }, updates?: { rootCause?: string; repairSummary?: string; patch?: string }): Promise<unknown>;
};

const fixtureRepository = "Aayushashsahu/sentinelforge-incident-fixture";

export async function prepareFixtureProofPlanningMission(input: { missionId: string; rootCause: string; repairSummary: string; patch: string; port: FixtureProofPlanningSetupPort }): Promise<FixtureProofPlanningMission> {
  assertCanonicalFixtureProofPatch(input.patch);
  const mission = await input.port.getMission(input.missionId);
  if (!mission) throw new Error("Fixture proof planning setup refused: mission was not found.");
  if (mission.repository !== fixtureRepository) throw new Error("Fixture proof planning setup refused: mission repository is outside the exact fixture allowlist.");
  if (mission.status === "PLANNING_FIX") {
    if (mission.rootCause !== input.rootCause || mission.repairSummary !== input.repairSummary || mission.patch !== input.patch) throw new Error("Fixture proof planning setup refused: existing planning artifacts differ from the immutable fixture proposal.");
    return mission;
  }
  if (mission.status !== "CREATED" && mission.status !== "INVESTIGATING") throw new Error(`Fixture proof planning setup refused: mission is not eligible for planning setup from ${mission.status}.`);
  if (mission.status === "CREATED") {
    if (input.port.setMissionStatusAndAudit) {
      await input.port.setMissionStatusAndAudit(mission.id, "INVESTIGATING", { eventType: "FIXTURE_PROOF_SETUP_INVESTIGATING", actor: "SentinelForge", result: "The fixture-proof setup entered the existing investigation state before proposing a repair." });
    } else {
      await input.port.setMissionStatus(mission.id, "INVESTIGATING");
      await input.port.appendAudit({ missionId: mission.id, eventType: "FIXTURE_PROOF_SETUP_INVESTIGATING", result: "The fixture-proof setup entered the existing investigation state before proposing a repair.", payload: {} });
    }
  }
  if (input.port.setMissionStatusAndAudit) {
    await input.port.setMissionStatusAndAudit(mission.id, "PLANNING_FIX", { eventType: "FIXTURE_PROOF_SETUP_PLANNING", actor: "SentinelForge", result: "The fixture-proof setup reached planning through the existing legal mission lifecycle and persisted the canonical un-applied proposal." }, { rootCause: input.rootCause, repairSummary: input.repairSummary, patch: input.patch });
  } else {
    await input.port.setMissionStatus(mission.id, "PLANNING_FIX", { rootCause: input.rootCause, repairSummary: input.repairSummary, patch: input.patch });
    await input.port.appendAudit({ missionId: mission.id, eventType: "FIXTURE_PROOF_SETUP_PLANNING", result: "The fixture-proof setup reached planning through the existing legal mission lifecycle and persisted the canonical un-applied proposal.", payload: {} });
  }
  const planned = await input.port.getMission(mission.id);
  if (!planned || planned.status !== "PLANNING_FIX" || planned.rootCause !== input.rootCause || planned.repairSummary !== input.repairSummary || planned.patch !== input.patch) throw new Error("Fixture proof planning setup refused: legal planning state was not durably persisted.");
  return planned;
}
