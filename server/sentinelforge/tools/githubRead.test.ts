import { afterEach, describe, expect, it, vi } from "vitest";

const owner = "Aayushashsahu";
const repo = "sentinelforge-incident-fixture";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("GitHubReadApi credential defaults", () => {
  it("uses GITHUB_READ_TOKEN as the generic-read default and never returns its value", async () => {
    const genericToken = "generic-default-test-token";
    vi.stubEnv("GITHUB_READ_TOKEN", genericToken);
    vi.resetModules();
    const { GitHubReadApi } = await import("./githubRead");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ type: "file", encoding: "base64", content: Buffer.from('{"version":"1.4.0"}').toString("base64") }), { status: 200 }));

    const result = await new GitHubReadApi(undefined, fetchImpl as typeof fetch).getFile(owner, repo, "package.json", "main");

    expect(result).toMatchObject({ repository: `${owner}/${repo}`, path: "package.json", ref: "main", text: '{"version":"1.4.0"}' });
    expect(JSON.stringify(result)).not.toContain(genericToken);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(`/repos/${owner}/${repo}/contents/package.json?ref=main`), expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${genericToken}` }) }));
  });
});
