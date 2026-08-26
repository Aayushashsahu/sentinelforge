import { ENV } from "../_core/env";
import { FIXTURE_PROOF_BASE_BRANCH, FIXTURE_PROOF_FILE, FIXTURE_PROOF_REPOSITORY, transformFixtureReleaseManifest, type FixtureProofGitHubPort } from "./fixtureGithubProof";
import { createGitHubWriteFailure } from "./githubWriteDiagnostics";
import { GitHubWriteCapabilityPolicy } from "./githubWriteCapability";

type GitHubResponse = { status: number; headers?: Headers; json(): Promise<unknown> };
export type GitHubFixtureFetch = (input: string, init?: RequestInit) => Promise<GitHubResponse>;

const [OWNER, REPOSITORY] = FIXTURE_PROOF_REPOSITORY.split("/") as [string, string];
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPOSITORY}`;
const BRANCH_COMMIT_MESSAGE = "SentinelForge fixture proof: align release manifest version";
const PULL_REQUEST_TITLE = "SentinelForge proof: align release manifest";
const PULL_REQUEST_BODY = "Approval-gated SentinelForge fixture proof. This PR changes only `release-manifest.json` from 1.3.0 to 1.4.0 and must remain open and unmerged.";

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function nonBlankString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value;
}

export class GitHubFixtureWriteApi implements FixtureProofGitHubPort {
  constructor(private readonly token = ENV.githubScratchPrToken, private readonly fetchImpl: GitHubFixtureFetch = fetch, private readonly capabilityPolicy = new GitHubWriteCapabilityPolicy()) {}

  private async request(operation: string, path: string, init: RequestInit = {}): Promise<unknown> {
    if (!this.token) throw new Error("Fixture GitHub proof refused: GITHUB_SCRATCH_PR_TOKEN is not configured server-side.");
    const response = await this.fetchImpl(`${API_BASE}${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "x-github-api-version": "2022-11-28",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status < 200 || response.status >= 300) {
      if (init.method === "POST" || init.method === "PUT") {
        throw await createGitHubWriteFailure({ status: response.status, method: init.method, endpoint: path, headers: response.headers, responseJson: () => response.json(), token: this.token, fallbackMessage: `Fixture GitHub ${operation} failed with HTTP ${response.status}.` });
      }
      throw new Error(`Fixture GitHub ${operation} failed with HTTP ${response.status}.`);
    }
    return response.json();
  }

  async getRepository() {
    const body = asRecord(await this.request("repository metadata read", ""), "Fixture GitHub repository metadata response was malformed.");
    return {
      full_name: nonBlankString(body.full_name, "Fixture GitHub repository full name was missing."),
      default_branch: nonBlankString(body.default_branch, "Fixture GitHub default branch was missing."),
      archived: body.archived === true,
    };
  }

  async getReleaseManifest(ref: string) {
    if (ref !== FIXTURE_PROOF_BASE_BRANCH) throw new Error("Fixture GitHub proof refused: manifest reads are allowed only from main.");
    const body = asRecord(await this.request("release manifest read", `/contents/${FIXTURE_PROOF_FILE}?ref=${encodeURIComponent(ref)}`), "Fixture GitHub manifest response was malformed.");
    if (body.encoding !== "base64") throw new Error("Fixture GitHub manifest response was not base64 encoded.");
    const content = nonBlankString(body.content, "Fixture GitHub manifest content was missing.");
    return { text: Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8"), sha: nonBlankString(body.sha, "Fixture GitHub manifest SHA was missing.") };
  }

  async getMainRef() {
    const body = asRecord(await this.request("main reference read", `/git/ref/heads/${FIXTURE_PROOF_BASE_BRANCH}`), "Fixture GitHub main reference response was malformed.");
    const object = asRecord(body.object, "Fixture GitHub main reference object was malformed.");
    return { sha: nonBlankString(object.sha, "Fixture GitHub main reference SHA was missing.") };
  }

  async getBranchRef(branchName: string) {
    if (!/^sentinelforge\/sf_[a-z0-9_-]{1,120}$/.test(branchName)) throw new Error("Fixture GitHub proof refused: branch lookup is outside the deterministic allowlist.");
    if (!this.token) throw new Error("Fixture GitHub proof refused: GITHUB_SCRATCH_PR_TOKEN is not configured server-side.");
    const response = await this.fetchImpl(`${API_BASE}/git/ref/heads/${encodeURIComponent(branchName)}`, {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${this.token}`, "x-github-api-version": "2022-11-28" },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 404) return null;
    if (response.status !== 200) throw new Error(`Fixture GitHub branch lookup failed with HTTP ${response.status}.`);
    const body = asRecord(await response.json(), "Fixture GitHub branch lookup response was malformed.");
    const object = asRecord(body.object, "Fixture GitHub branch lookup object was malformed.");
    return { sha: nonBlankString(object.sha, "Fixture GitHub branch lookup SHA was missing.") };
  }

  async findOpenPullRequests(branchName: string) {
    const path = `/pulls?state=open&head=${encodeURIComponent(`${OWNER}:${branchName}`)}&base=${FIXTURE_PROOF_BASE_BRANCH}&per_page=1`;
    const body = await this.request("open pull request lookup", path);
    if (!Array.isArray(body)) throw new Error("Fixture GitHub pull-request lookup response was malformed.");
    return body.map(item => {
      const pr = asRecord(item, "Fixture GitHub pull-request lookup item was malformed.");
      const base = asRecord(pr.base, "Fixture GitHub pull-request base was malformed.");
      const head = asRecord(pr.head, "Fixture GitHub pull-request head was malformed.");
      return { number: Number(pr.number), html_url: nonBlankString(pr.html_url, "Fixture GitHub pull-request URL was missing."), state: nonBlankString(pr.state, "Fixture GitHub pull-request state was missing."), base: { ref: nonBlankString(base.ref, "Fixture GitHub pull-request base ref was missing.") }, head: { ref: nonBlankString(head.ref, "Fixture GitHub pull-request head ref was missing.") }, auto_merge: pr.auto_merge ?? null };
    });
  }

  async createBranch(input: { branchName: string; baseSha: string }) {
    if (!/^sentinelforge\/sf_[a-z0-9_-]{1,120}$/.test(input.branchName) || !/^[a-f0-9]{40}$/i.test(input.baseSha)) throw new Error("Fixture GitHub proof refused: branch request is outside the deterministic allowlist.");
    this.capabilityPolicy.require(FIXTURE_PROOF_REPOSITORY, { capability: "contents:write", method: "POST", endpoint: "/git/refs" });
    const body = asRecord(await this.request("branch creation", "/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${input.branchName}`, sha: input.baseSha }) }), "Fixture GitHub branch response was malformed.");
    const object = asRecord(body.object, "Fixture GitHub branch object was malformed.");
    return { sha: nonBlankString(object.sha, "Fixture GitHub branch SHA was missing.") };
  }

  async updateReleaseManifest(input: { branchName: string; contentSha: string; content: string }) {
    if (!/^sentinelforge\/sf_[a-z0-9_-]{1,120}$/.test(input.branchName) || !/^[a-f0-9]{40}$/i.test(input.contentSha)) throw new Error("Fixture GitHub proof refused: update request is outside the deterministic allowlist.");
    this.capabilityPolicy.require(FIXTURE_PROOF_REPOSITORY, { capability: "contents:write", method: "PUT", endpoint: `/contents/${FIXTURE_PROOF_FILE}` });
    const current = await this.getReleaseManifest(FIXTURE_PROOF_BASE_BRANCH);
    if (current.sha !== input.contentSha || transformFixtureReleaseManifest(current.text) !== input.content) throw new Error("Fixture GitHub proof refused: update content is not the exact current main manifest transformation.");
    const body = asRecord(await this.request("release manifest update", `/contents/${FIXTURE_PROOF_FILE}`, { method: "PUT", body: JSON.stringify({ message: BRANCH_COMMIT_MESSAGE, content: Buffer.from(input.content, "utf8").toString("base64"), sha: input.contentSha, branch: input.branchName }) }), "Fixture GitHub commit response was malformed.");
    const commit = asRecord(body.commit, "Fixture GitHub commit metadata was malformed.");
    return { commitSha: nonBlankString(commit.sha, "Fixture GitHub commit SHA was missing.") };
  }

  async createPullRequest(input: { branchName: string }) {
    if (!/^sentinelforge\/sf_[a-z0-9_-]{1,120}$/.test(input.branchName)) throw new Error("Fixture GitHub proof refused: pull-request branch is outside the deterministic allowlist.");
    this.capabilityPolicy.require(FIXTURE_PROOF_REPOSITORY, { capability: "pull_requests:write", method: "POST", endpoint: "/pulls" });
    const body = asRecord(await this.request("pull request creation", "/pulls", { method: "POST", body: JSON.stringify({ title: PULL_REQUEST_TITLE, body: PULL_REQUEST_BODY, head: input.branchName, base: FIXTURE_PROOF_BASE_BRANCH, maintainer_can_modify: false }) }), "Fixture GitHub pull-request creation response was malformed.");
    return this.mapPullRequest(body);
  }

  async getPullRequest(number: number) {
    if (!Number.isInteger(number) || number < 1) throw new Error("Fixture GitHub proof refused: pull-request number is invalid.");
    return this.mapPullRequest(asRecord(await this.request("pull request verification", `/pulls/${number}`), "Fixture GitHub pull-request verification response was malformed."));
  }

  private mapPullRequest(body: Record<string, unknown>) {
    const base = asRecord(body.base, "Fixture GitHub pull-request base was malformed.");
    const head = asRecord(body.head, "Fixture GitHub pull-request head was malformed.");
    return { number: Number(body.number), htmlUrl: nonBlankString(body.html_url, "Fixture GitHub pull-request URL was missing."), state: nonBlankString(body.state, "Fixture GitHub pull-request state was missing."), base: nonBlankString(base.ref, "Fixture GitHub pull-request base ref was missing."), head: nonBlankString(head.ref, "Fixture GitHub pull-request head ref was missing."), autoMerge: body.auto_merge ?? null };
  }
}
