import { describe, expect, it } from "vitest";
import { LIVE_FIXTURE_PROOF_OWNER, LIVE_FIXTURE_PROOF_REPO, parseLiveFixtureProofHarnessConfig } from "./fixtureProofLiveHarness";

const validEvidence = JSON.stringify([
  { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "contents:write", method: "POST", endpoint: "/git/refs", status: 201, acceptedGithubPermissions: "contents=write" },
  { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "contents:write", method: "PUT", endpoint: "/contents/release-manifest.json", status: 200, acceptedGithubPermissions: "contents=write" },
  { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "pull_requests:write", method: "POST", endpoint: "/pulls", status: 201, acceptedGithubPermissions: "pull_requests=write" },
]);
function environment(overrides: Record<string, string | undefined> = {}) { return { GITHUB_SCRATCH_PR_TOKEN: "secure-input-only-token", GITHUB_SCRATCH_OWNER: LIVE_FIXTURE_PROOF_OWNER, GITHUB_SCRATCH_REPO: LIVE_FIXTURE_PROOF_REPO, GITHUB_SCRATCH_WRITE_CAPABILITY_EVIDENCE: validEvidence, ...overrides }; }

describe("live fixture proof harness configuration", () => {
  it("requires only exact explicit fixture target values and response-shaped capability evidence", () => {
    const config = parseLiveFixtureProofHarnessConfig(environment());
    expect(config.owner).toBe("Aayushashsahu");
    expect(config.repo).toBe("sentinelforge-incident-fixture");
    expect(config.token).toBe("secure-input-only-token");
    expect(config.writeCapabilityEvidence).toHaveLength(3);
  });

  it.each([
    ["missing credentials", { GITHUB_SCRATCH_PR_TOKEN: undefined }, /GITHUB_SCRATCH_PR_TOKEN/],
    ["wrong owner", { GITHUB_SCRATCH_OWNER: "other" }, /exact fixture allowlist owner/],
    ["wrong repository", { GITHUB_SCRATCH_REPO: "other" }, /exact fixture allowlist repository/],
    ["missing write capability", { GITHUB_SCRATCH_WRITE_CAPABILITY_EVIDENCE: undefined }, /write-capability evidence/],
    ["malformed capability evidence", { GITHUB_SCRATCH_WRITE_CAPABILITY_EVIDENCE: "{}" }, /must be an array/],
  ])("fails closed for %s", (_label, overrides, message) => {
    expect(() => parseLiveFixtureProofHarnessConfig(environment(overrides))).toThrow(message);
  });

  it("does not use ambient GitHub credential variables as a fallback", () => {
    const config = parseLiveFixtureProofHarnessConfig({ ...environment(), GH_TOKEN: "ambient", GITHUB_TOKEN: "ambient", GITHUB_READ_TOKEN: "ambient" });
    expect(config.token).toBe("secure-input-only-token");
  });
});
