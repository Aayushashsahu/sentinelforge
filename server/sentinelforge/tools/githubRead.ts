import { ENV } from "../../_core/env";

export const SENTINELFORGE_ALLOWED_REPOSITORIES = ["Aayushashsahu/sentinelforge-incident-fixture"] as const;
const MAX_FILE_TEXT_BYTES = 200_000;

export type GitHubFetch = typeof fetch;

type GitHubContentResponse = {
  type: "file" | "dir" | "symlink" | "submodule";
  encoding?: string;
  content?: string;
  size?: number;
};

function assertAllowedRepository(owner: string, repo: string): string {
  const fullName = `${owner}/${repo}`;
  if (!(SENTINELFORGE_ALLOWED_REPOSITORIES as readonly string[]).includes(fullName)) {
    throw new Error(`Repository ${fullName} is not an allowed SentinelForge investigation target.`);
  }
  return fullName;
}

function ensureTextFile(content: GitHubContentResponse, fullName: string, path: string): string {
  if (content.type !== "file" || content.encoding !== "base64" || typeof content.content !== "string") {
    throw new Error(`${fullName}/${path} is not a base64-encoded text file response.`);
  }
  const decoded = Buffer.from(content.content.replace(/\s/g, ""), "base64");
  if (decoded.byteLength > MAX_FILE_TEXT_BYTES) throw new Error(`${fullName}/${path} exceeds the maximum allowed text size.`);
  const text = decoded.toString("utf8");
  if (!text.trim()) throw new Error(`${fullName}/${path} is empty.`);
  return text;
}

export class GitHubReadApi {
  constructor(private readonly token = ENV.githubReadToken, private readonly fetchImpl: GitHubFetch = fetch) {}

  private async request(path: string): Promise<unknown> {
    if (!this.token) throw new Error("GITHUB_READ_TOKEN is not configured for sentinelforge-tools.");
    const response = await this.fetchImpl(`https://api.github.com${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "x-github-api-version": "2022-11-28",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`GitHub read request failed with HTTP ${response.status}.`);
    return response.json();
  }

  async getRepository(owner: string, repo: string): Promise<unknown> {
    assertAllowedRepository(owner, repo);
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  async getFile(owner: string, repo: string, path: string, ref: string): Promise<{ repository: string; path: string; ref: string; text: string }> {
    const fullName = assertAllowedRepository(owner, repo);
    if (!path || path.startsWith("/") || path.includes("..")) throw new Error("File path must be a safe repository-relative path.");
    if (!ref.trim()) throw new Error("A Git reference is required.");
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const payload = await this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`) as GitHubContentResponse;
    return { repository: fullName, path, ref, text: ensureTextFile(payload, fullName, path) };
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<unknown> {
    assertAllowedRepository(owner, repo);
    if (!Number.isInteger(issueNumber) || issueNumber < 1) throw new Error("issue_number must be a positive integer.");
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`);
  }

  async getWorkflowRun(owner: string, repo: string, runId: number): Promise<unknown> {
    assertAllowedRepository(owner, repo);
    if (!Number.isInteger(runId) || runId < 1) throw new Error("run_id must be a positive integer.");
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}`);
  }
}
