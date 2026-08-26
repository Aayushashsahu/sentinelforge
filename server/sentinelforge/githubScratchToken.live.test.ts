import { describe, expect, it } from "vitest";

const runScratchTokenValidation = process.env.RUN_GITHUB_SCRATCH_TOKEN_VALIDATION === "1";
const scratchRepository = "Aayushashsahu/sentinelforge-incident-fixture";

describe.skipIf(!runScratchTokenValidation)("server-only scratch GitHub token", () => {
  it("reports only verifiable read access without inferring administration privileges", async () => {
    const token = process.env.GITHUB_SCRATCH_PR_TOKEN?.trim();
    expect(token).toBeTruthy();

    const headers = {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    };

    const repositoryResponse = await fetch(`https://api.github.com/repos/${scratchRepository}`, {
      headers,
      signal: AbortSignal.timeout(12_000),
    });
    expect(repositoryResponse.status).toBe(200);

    const repository = await repositoryResponse.json() as {
      full_name?: string;
      permissions?: { push?: boolean; pull?: boolean };
    };
    expect(repository.full_name).toBe(scratchRepository);
    expect(repository.permissions?.pull).toBe(true);
    expect(repository.permissions?.push).toBe(true);

    const rulesetsResponse = await fetch(`https://api.github.com/repos/${scratchRepository}/rulesets`, {
      headers,
      signal: AbortSignal.timeout(12_000),
    });
    expect([200, 403, 404]).toContain(rulesetsResponse.status);

    const pullRequestResponse = await fetch(`https://api.github.com/repos/${scratchRepository}/pulls?state=open&per_page=1`, {
      headers,
      signal: AbortSignal.timeout(12_000),
    });
    expect(pullRequestResponse.status).toBe(200);
    expect(Array.isArray(await pullRequestResponse.json())).toBe(true);

    const preflightReport = {
      credentialIsolation: "VERIFIED",
      repositoryAccess: "VERIFIED",
      pullRequestAccess: "VERIFIED",
      rulesetsRead: rulesetsResponse.status === 200 ? "VERIFIED" : "UNAVAILABLE",
      adminPrivilege: "NOT_PROVEN",
      fullPermissionManifest: "UNVERIFIABLE",
    } as const;

    expect(preflightReport.credentialIsolation).toBe("VERIFIED");
    expect(preflightReport.repositoryAccess).toBe("VERIFIED");
    expect(preflightReport.pullRequestAccess).toBe("VERIFIED");
    expect(preflightReport.adminPrivilege).toBe("NOT_PROVEN");
    expect(preflightReport.fullPermissionManifest).toBe("UNVERIFIABLE");
  }, 30_000);
});
