import { createHash } from "node:crypto";

export const FIXTURE_PROOF_REPOSITORY = "Aayushashsahu/sentinelforge-incident-fixture" as const;
export const FIXTURE_PROOF_BASE_BRANCH = "main" as const;
export const FIXTURE_PROOF_FILE = "release-manifest.json" as const;
export const FIXTURE_PROOF_BEFORE_VERSION = "1.3.0" as const;
export const FIXTURE_PROOF_AFTER_VERSION = "1.4.0" as const;

export type FixtureProofIntent = {
  missionId: string;
  repository: typeof FIXTURE_PROOF_REPOSITORY;
  baseBranch: typeof FIXTURE_PROOF_BASE_BRANCH;
  filePath: typeof FIXTURE_PROOF_FILE;
  beforeVersion: typeof FIXTURE_PROOF_BEFORE_VERSION;
  afterVersion: typeof FIXTURE_PROOF_AFTER_VERSION;
  branchName: string;
  proposalFingerprint: string;
  idempotencyKey: string;
};

export type FixtureProofPreflight = {
  repository: typeof FIXTURE_PROOF_REPOSITORY;
  baseBranch: typeof FIXTURE_PROOF_BASE_BRANCH;
  contentSha: string;
  baseSha: string;
  beforeContent: string;
  afterContent: string;
  branchName: string;
};

export type FixtureProofActionStatus = "AWAITING_APPROVAL" | "WAITING_APPROVAL" | "STAGED" | "EXECUTING" | "BRANCH_CREATED" | "COMMIT_CREATED" | "PR_CREATED" | "PARTIAL_BRANCH_CREATED" | "PARTIAL_COMMIT_CREATED" | "PARTIAL_PR_CREATED" | "FAILED";

export type FixtureProofAction = {
  id: string;
  missionId: string;
  status: FixtureProofActionStatus;
  intent: FixtureProofIntent;
  preflight: FixtureProofPreflight;
  approval: {
    approvalRequestId: string | null;
    trueforgeSessionId: string | null;
    turnId: string | null;
    threadId: string | null;
    toolCallId: string | null;
    requiredActionId: string | null;
    continuationId: string | null;
    continuationStatus: "NOT_SENT" | "SENT";
  };
  remote: {
    branchSha?: string;
    commitSha?: string;
    pullRequestNumber?: number;
    pullRequestUrl?: string;
  };
};

type RepositoryMetadata = { full_name: string; default_branch: string; archived: boolean };
type FileContent = { text: string; sha: string };
type Ref = { sha: string };
type PullRequest = { number: number; html_url: string; state: string; base: { ref: string }; head: { ref: string }; auto_merge: unknown };

export type FixtureProofGitHubPort = {
  getRepository(): Promise<RepositoryMetadata>;
  getReleaseManifest(ref: string): Promise<FileContent>;
  getMainRef(): Promise<Ref>;
  getBranchRef(branchName: string): Promise<Ref | null>;
  findOpenPullRequests(branchName: string): Promise<PullRequest[]>;
  createBranch(input: { branchName: string; baseSha: string }): Promise<{ sha: string }>;
  updateReleaseManifest(input: { branchName: string; contentSha: string; content: string }): Promise<{ commitSha: string }>;
  createPullRequest(input: { branchName: string }): Promise<{ number: number; htmlUrl: string; state: string; base: string; head: string; autoMerge: unknown }>;
  getPullRequest(number: number): Promise<{ number: number; htmlUrl: string; state: string; base: string; head: string; autoMerge: unknown }>;
};

export type FixtureProofPersistencePort = {
  getAction(actionId: string): Promise<FixtureProofAction | null>;
  claimActionForExecution(actionId: string): Promise<boolean>;
  updateAction(actionId: string, update: Pick<FixtureProofAction, "status" | "remote">): Promise<void>;
  appendAudit(input: { missionId: string; eventType: string; correlationId: string; result: string; payload: Record<string, unknown> }): Promise<void>;
};

function assertCanonicalMissionId(missionId: string): void {
  if (!/^SF_[A-Za-z0-9_-]{1,120}$/.test(missionId)) throw new Error("Fixture proof refused: a canonical SentinelForge mission identifier is required.");
}

function assertFingerprint(fingerprint: string): void {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error("Fixture proof refused: proposal fingerprint is invalid.");
}

function assertExactIntent(intent: FixtureProofIntent): void {
  assertCanonicalMissionId(intent.missionId);
  assertFingerprint(intent.proposalFingerprint);
  if (intent.repository !== FIXTURE_PROOF_REPOSITORY || intent.baseBranch !== FIXTURE_PROOF_BASE_BRANCH || intent.filePath !== FIXTURE_PROOF_FILE || intent.beforeVersion !== FIXTURE_PROOF_BEFORE_VERSION || intent.afterVersion !== FIXTURE_PROOF_AFTER_VERSION) {
    throw new Error("Fixture proof refused: target does not match the immutable proof allowlist.");
  }
  const expectedBranch = `sentinelforge/${intent.missionId.toLowerCase()}`;
  if (intent.branchName !== expectedBranch || !/^[a-z0-9/_-]{4,128}$/.test(intent.branchName)) throw new Error("Fixture proof refused: deterministic branch name is invalid.");
  const expectedKey = `fixture-github-pr:${intent.missionId}:${intent.proposalFingerprint}`;
  if (intent.idempotencyKey !== expectedKey) throw new Error("Fixture proof refused: idempotency key does not bind the mission and proposal fingerprint.");
}

export function buildFixtureProofIntent(input: { missionId: string; proposalFingerprint: string }): FixtureProofIntent {
  assertCanonicalMissionId(input.missionId);
  assertFingerprint(input.proposalFingerprint);
  const branchName = `sentinelforge/${input.missionId.toLowerCase()}`;
  return {
    missionId: input.missionId,
    repository: FIXTURE_PROOF_REPOSITORY,
    baseBranch: FIXTURE_PROOF_BASE_BRANCH,
    filePath: FIXTURE_PROOF_FILE,
    beforeVersion: FIXTURE_PROOF_BEFORE_VERSION,
    afterVersion: FIXTURE_PROOF_AFTER_VERSION,
    branchName,
    proposalFingerprint: input.proposalFingerprint,
    idempotencyKey: `fixture-github-pr:${input.missionId}:${input.proposalFingerprint}`,
  };
}

export function transformFixtureReleaseManifest(beforeContent: string): string {
  let parsed: unknown;
  try { parsed = JSON.parse(beforeContent); } catch { throw new Error("Fixture proof refused: release manifest is not valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || (parsed as { version?: unknown }).version !== FIXTURE_PROOF_BEFORE_VERSION) {
    throw new Error("Fixture proof refused: release manifest does not have the expected current version.");
  }
  const replacements = beforeContent.match(/"version"\s*:\s*"1\.3\.0"/g) ?? [];
  if (replacements.length !== 1) throw new Error("Fixture proof refused: release manifest must contain exactly one expected version field.");
  const afterContent = beforeContent.replace(/("version"\s*:\s*")1\.3\.0(")/, `$1${FIXTURE_PROOF_AFTER_VERSION}$2`);
  const afterParsed = JSON.parse(afterContent) as { version: unknown };
  if (afterParsed.version !== FIXTURE_PROOF_AFTER_VERSION) throw new Error("Fixture proof refused: proposed release manifest transformation is invalid.");
  return afterContent;
}

export function assertCanonicalFixtureProofPatch(patch: string): void {
  const lines = patch.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const headers = ["diff --git a/release-manifest.json b/release-manifest.json", "--- a/release-manifest.json", "+++ b/release-manifest.json"];
  if (lines.length < 6 || !headers.every((line, index) => lines[index] === line) || !lines[3]!.startsWith("@@")) throw new Error("Fixture proof refused: proposal patch is not a canonical release-manifest unified diff.");
  const changed = lines.slice(4).filter(line => line.startsWith("+") || line.startsWith("-"));
  if (changed.length !== 2 || changed[0] !== '-  "version": "1.3.0",' || changed[1] !== '+  "version": "1.4.0",') throw new Error("Fixture proof refused: proposal patch must contain only the exact one-line version transformation.");
}

export async function readFixtureProofPreflight(github: FixtureProofGitHubPort, intent: FixtureProofIntent): Promise<FixtureProofPreflight> {
  assertExactIntent(intent);
  const repository = await github.getRepository();
  if (repository.full_name !== FIXTURE_PROOF_REPOSITORY || repository.default_branch !== FIXTURE_PROOF_BASE_BRANCH || repository.archived) {
    throw new Error("Fixture proof refused: repository identity, base branch, or archived state does not match the allowlist.");
  }
  const [manifest, mainRef, existingBranch, existingPullRequests] = await Promise.all([
    github.getReleaseManifest(FIXTURE_PROOF_BASE_BRANCH),
    github.getMainRef(),
    github.getBranchRef(intent.branchName),
    github.findOpenPullRequests(intent.branchName),
  ]);
  if (!/^[a-f0-9]{40}$/i.test(manifest.sha) || !/^[a-f0-9]{40}$/i.test(mainRef.sha)) throw new Error("Fixture proof refused: GitHub returned an invalid content or base SHA.");
  if (existingBranch) throw new Error("Fixture proof refused: the deterministic branch already exists.");
  if (existingPullRequests.length > 0) throw new Error("Fixture proof refused: an open pull request already exists for the deterministic branch.");
  return {
    repository: FIXTURE_PROOF_REPOSITORY,
    baseBranch: FIXTURE_PROOF_BASE_BRANCH,
    contentSha: manifest.sha,
    baseSha: mainRef.sha,
    beforeContent: manifest.text,
    afterContent: transformFixtureReleaseManifest(manifest.text),
    branchName: intent.branchName,
  };
}

function assertApprovedAction(action: FixtureProofAction): void {
  assertExactIntent(action.intent);
  if (action.status !== "STAGED") throw new Error("Fixture proof refused: action is not in the one-time staged state.");
  if (action.preflight.repository !== FIXTURE_PROOF_REPOSITORY || action.preflight.baseBranch !== FIXTURE_PROOF_BASE_BRANCH || action.preflight.branchName !== action.intent.branchName) {
    throw new Error("Fixture proof refused: persisted preflight target differs from the immutable allowlist.");
  }
  if (action.preflight.afterContent !== transformFixtureReleaseManifest(action.preflight.beforeContent)) throw new Error("Fixture proof refused: persisted file transformation differs from the approved exact repair.");
  if (!action.approval.approvalRequestId || !action.approval.trueforgeSessionId || !action.approval.turnId || !action.approval.threadId || !action.approval.toolCallId || !action.approval.requiredActionId || !action.approval.continuationId || action.approval.continuationStatus !== "SENT") {
    throw new Error("Fixture proof refused: persisted approval correlation or continuation state is incomplete.");
  }
}

function safeRemoteSummary(action: FixtureProofAction): Record<string, unknown> {
  return { actionId: action.id, branchName: action.intent.branchName, repository: action.intent.repository, file: action.intent.filePath, remote: action.remote };
}

export async function executeApprovedFixtureProof(input: { github: FixtureProofGitHubPort; persistence: FixtureProofPersistencePort; actionId: string }): Promise<FixtureProofAction> {
  const action = await input.persistence.getAction(input.actionId);
  if (!action) throw new Error("Fixture proof refused: staged action was not found.");
  assertApprovedAction(action);
  if (!await input.persistence.claimActionForExecution(action.id)) throw new Error("Fixture proof refused: action was already claimed or is no longer staged.");
  action.status = "EXECUTING";
  try {
    const current = await readFixtureProofPreflight(input.github, action.intent);
    if (current.baseSha !== action.preflight.baseSha || current.contentSha !== action.preflight.contentSha || current.beforeContent !== action.preflight.beforeContent || current.afterContent !== action.preflight.afterContent) throw new Error("Fixture proof refused: repository base or file changed after preflight and approval.");
  } catch (error) {
    action.status = "FAILED";
    await input.persistence.updateAction(action.id, { status: action.status, remote: action.remote });
    await input.persistence.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_PREFLIGHT_FAILED", correlationId: action.id, result: "The claimed proof failed its final read-only preflight. No GitHub write was attempted.", payload: safeRemoteSummary(action) });
    throw error;
  }

  try {
    const branch = await input.github.createBranch({ branchName: action.intent.branchName, baseSha: action.preflight.baseSha });
    action.status = "BRANCH_CREATED";
    action.remote.branchSha = branch.sha;
    await input.persistence.updateAction(action.id, { status: action.status, remote: action.remote });
    await input.persistence.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_BRANCH_CREATED", correlationId: action.id, result: "The one allowlisted fixture-proof branch was created after a sent approval continuation.", payload: safeRemoteSummary(action) });
  } catch (error) {
    action.status = "PARTIAL_BRANCH_CREATED";
    await input.persistence.updateAction(action.id, { status: action.status, remote: action.remote });
    await input.persistence.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_BRANCH_PARTIAL", correlationId: action.id, result: "Branch creation did not return a confirmed result. The proof stopped without retry or rollback.", payload: safeRemoteSummary(action) });
    throw error;
  }

  try {
    const commit = await input.github.updateReleaseManifest({ branchName: action.intent.branchName, contentSha: action.preflight.contentSha, content: action.preflight.afterContent });
    action.status = "COMMIT_CREATED";
    action.remote.commitSha = commit.commitSha;
    await input.persistence.updateAction(action.id, { status: action.status, remote: action.remote });
    await input.persistence.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_COMMIT_CREATED", correlationId: action.id, result: "The one allowlisted release-manifest repair commit was created on the dedicated branch.", payload: safeRemoteSummary(action) });
  } catch (error) {
    action.status = "PARTIAL_COMMIT_CREATED";
    await input.persistence.updateAction(action.id, { status: action.status, remote: action.remote });
    await input.persistence.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_COMMIT_PARTIAL", correlationId: action.id, result: "Commit creation did not return a confirmed result. The proof stopped without retry, second commit, or rollback.", payload: safeRemoteSummary(action) });
    throw error;
  }

  try {
    const pullRequest = await input.github.createPullRequest({ branchName: action.intent.branchName });
    action.status = "PARTIAL_PR_CREATED";
    action.remote.pullRequestNumber = pullRequest.number;
    action.remote.pullRequestUrl = pullRequest.htmlUrl;
    await input.persistence.updateAction(action.id, { status: action.status, remote: action.remote });
    await input.persistence.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_PR_PARTIAL", correlationId: action.id, result: "Pull-request creation returned an identity; verification is pending. The proof remains terminal and will not retry or create another PR.", payload: safeRemoteSummary(action) });
    if (pullRequest.state !== "open" || pullRequest.base !== FIXTURE_PROOF_BASE_BRANCH || pullRequest.head !== action.intent.branchName || pullRequest.autoMerge !== null) throw new Error("Fixture proof refused: created pull request does not match its immutable open, unmerged intent.");
    const verified = await input.github.getPullRequest(pullRequest.number);
    if (verified.number !== pullRequest.number || verified.state !== "open" || verified.base !== FIXTURE_PROOF_BASE_BRANCH || verified.head !== action.intent.branchName || verified.autoMerge !== null) throw new Error("Fixture proof refused: created pull request verification failed.");
    action.status = "PR_CREATED";
    action.remote.pullRequestNumber = verified.number;
    action.remote.pullRequestUrl = verified.htmlUrl;
    await input.persistence.updateAction(action.id, { status: action.status, remote: action.remote });
    await input.persistence.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_PR_CREATED", correlationId: action.id, result: "The one allowlisted pull request was verified open and unmerged. The proof is terminal and no additional GitHub mutation is permitted.", payload: safeRemoteSummary(action) });
    return action;
  } catch (error) {
    action.status = "PARTIAL_PR_CREATED";
    await input.persistence.updateAction(action.id, { status: action.status, remote: action.remote });
    await input.persistence.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_PR_PARTIAL", correlationId: action.id, result: "Pull-request creation did not return a confirmed open PR. The proof stopped without retry, second pull request, or rollback.", payload: safeRemoteSummary(action) });
    throw error;
  }
}

export function fixtureProofFingerprint(input: { summary: string | null; patch: string }): string {
  return createHash("sha256").update(JSON.stringify({ summary: input.summary, patch: input.patch, fixtureProof: FIXTURE_PROOF_REPOSITORY })).digest("hex");
}
