import { ENV } from "../_core/env";
import { FIXTURE_PROOF_AFTER_VERSION, FIXTURE_PROOF_BASE_BRANCH, FIXTURE_PROOF_BEFORE_VERSION, FIXTURE_PROOF_FILE, FIXTURE_PROOF_REPOSITORY, fixtureProofFingerprint, type FixtureProofAction } from "./fixtureGithubProof";
import { markFixtureProofServerEvidence } from "./liveFixtureProof";
import { GitHubReadApi } from "./tools/githubRead";

export type FixtureProofServerEvidencePort = {
  getMissionBundle(missionId: string): Promise<{ mission: { id: string; status: string; repository: string; repairSummary: string | null; patch: string | null } } | null>;
  getAction(actionId: string): Promise<FixtureProofAction | null>;
  replaceAction(action: FixtureProofAction): Promise<void>;
  appendAudit(input: { missionId: string; eventType: string; correlationId: string; result: string; payload: Record<string, unknown> }): Promise<void>;
};

export type FixtureProofServerReadClient = Pick<GitHubReadApi, "getFile">;
export type FixtureProofServerReadClientFactory = () => FixtureProofServerReadClient;

export function createFixtureProofServerReadClient(): FixtureProofServerReadClient {
  const token = ENV.githubScratchPrToken;
  if (!token) throw new Error("Fixture proof server evidence refused: GITHUB_SCRATCH_PR_TOKEN is not configured server-side.");
  return new GitHubReadApi(token);
}

function assertVersion(text: string, expectedVersion: string, artifact: string): void {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error(`Fixture proof server evidence refused: ${artifact} is not valid JSON.`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || (parsed as { version?: unknown }).version !== expectedVersion) {
    throw new Error(`Fixture proof server evidence refused: ${artifact} does not contain required version ${expectedVersion}.`);
  }
}

async function resolveAction(input: { missionId: string; actionId: string; port: FixtureProofServerEvidencePort }): Promise<FixtureProofAction> {
  const [bundle, action] = await Promise.all([input.port.getMissionBundle(input.missionId), input.port.getAction(input.actionId)]);
  if (!bundle || !action || action.missionId !== input.missionId || action.status !== "AWAITING_APPROVAL") throw new Error("Fixture proof server evidence refused: persisted action does not match the planning mission.");
  const expectedFingerprint = fixtureProofFingerprint({ summary: bundle.mission.repairSummary, patch: bundle.mission.patch ?? "" });
  if (bundle.mission.id !== input.missionId || bundle.mission.status !== "PLANNING_FIX" || bundle.mission.repository !== FIXTURE_PROOF_REPOSITORY || action.intent.repository !== FIXTURE_PROOF_REPOSITORY || action.intent.baseBranch !== FIXTURE_PROOF_BASE_BRANCH || action.intent.filePath !== FIXTURE_PROOF_FILE || action.intent.proposalFingerprint !== expectedFingerprint || action.readEvidence.correlation !== null) {
    throw new Error("Fixture proof server evidence refused: immutable mission, action, fingerprint, target, or correlation state is invalid.");
  }
  return action;
}

export async function acquireFixtureProofServerEvidence(input: { missionId: string; actionId: string; port: FixtureProofServerEvidencePort; createReadClient?: FixtureProofServerReadClientFactory }): Promise<FixtureProofAction> {
  const action = await resolveAction(input);
  const client = (input.createReadClient ?? createFixtureProofServerReadClient)();
  const [owner, repository] = action.intent.repository.split("/") as [string, string];
  const packageFile = await client.getFile(owner, repository, "package.json", action.intent.baseBranch);
  assertVersion(packageFile.text, FIXTURE_PROOF_AFTER_VERSION, "package.json");
  let evidenced = markFixtureProofServerEvidence({ action, path: "package.json" });
  await input.port.replaceAction(evidenced);
  await input.port.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_PROOF_SERVER_PACKAGE_EVIDENCE_VERIFIED", correlationId: action.id, result: "The server verified the canonical package.json version with the action-bound scratch credential; no provider tool call or GitHub mutation occurred.", payload: { actionId: action.id, artifact: "package.json", expectedVersion: FIXTURE_PROOF_AFTER_VERSION, source: "SERVER_ORCHESTRATED" } });

  const manifestFile = await client.getFile(owner, repository, action.intent.filePath, action.intent.baseBranch);
  assertVersion(manifestFile.text, FIXTURE_PROOF_BEFORE_VERSION, action.intent.filePath);
  evidenced = markFixtureProofServerEvidence({ action: evidenced, path: "release-manifest.json" });
  await input.port.replaceAction(evidenced);
  await input.port.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_PROOF_SERVER_MANIFEST_EVIDENCE_VERIFIED", correlationId: action.id, result: "The server verified the canonical release-manifest.json version with the action-bound scratch credential; no provider tool call or GitHub mutation occurred.", payload: { actionId: action.id, artifact: FIXTURE_PROOF_FILE, expectedVersion: FIXTURE_PROOF_BEFORE_VERSION, source: "SERVER_ORCHESTRATED" } });
  return evidenced;
}
