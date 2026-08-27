import { describe, expect, it } from "vitest";
import { LIVE_FIXTURE_PROOF_OWNER, LIVE_FIXTURE_PROOF_REPO, parseLiveFixtureProofHarnessConfig } from "./fixtureProofLiveHarness";

const configuredCapabilities = JSON.stringify([
  { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "contents:write" },
  { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "pull_requests:write" },
]);
function environment(overrides: Record<string, string | undefined> = {}) { return { GITHUB_SCRATCH_PR_TOKEN: "secure-input-only-token", GITHUB_SCRATCH_OWNER: LIVE_FIXTURE_PROOF_OWNER, GITHUB_SCRATCH_REPO: LIVE_FIXTURE_PROOF_REPO, GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: configuredCapabilities, ...overrides }; }

describe("live fixture proof harness configuration", () => {
  it("requires only exact explicit fixture target values and configured write capabilities", () => {
    const config = parseLiveFixtureProofHarnessConfig(environment());
    expect(config.owner).toBe("Aayushashsahu");
    expect(config.repo).toBe("sentinelforge-incident-fixture");
    expect(config.token).toBe("secure-input-only-token");
    expect(config.configuredCapabilities).toHaveLength(2);
  });

  it.each([
    ["missing credentials", { GITHUB_SCRATCH_PR_TOKEN: undefined }, /GITHUB_SCRATCH_PR_TOKEN/],
    ["wrong owner", { GITHUB_SCRATCH_OWNER: "other" }, /exact fixture allowlist owner/],
    ["wrong repository", { GITHUB_SCRATCH_REPO: "other" }, /exact fixture allowlist repository/],
    ["missing configured capability", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: undefined }, /configured write capabilities/],
    ["malformed JSON", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: "[" }, /not valid JSON/],
    ["object instead of array", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: "{}" }, /must be an array/],
    ["empty array", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: "[]" }, /must not be empty/],
    ["missing entry repository", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: JSON.stringify([{ capability: "contents:write" }, { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "pull_requests:write" }]) }, /repository is required/],
    ["missing entry capability", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: JSON.stringify([{ repository: "Aayushashsahu/sentinelforge-incident-fixture" }, { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "pull_requests:write" }]) }, /capability is required/],
    ["read-only configured capability", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: JSON.stringify([{ repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "contents:read" }]) }, /exact required write capability/],
    ["wrong configured repository", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: JSON.stringify([{ repository: "Aayushashsahu/other", capability: "contents:write" }]) }, /outside the exact fixture allowlist/],
    ["duplicate capability", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: JSON.stringify([{ repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "contents:write" }, { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "contents:write" }, { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "pull_requests:write" }]) }, /contents:write is duplicated/],
    ["duplicate repository capability entry", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: JSON.stringify([{ repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "pull_requests:write" }, { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "pull_requests:write" }, { repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "contents:write" }]) }, /pull_requests:write is duplicated/],
    ["missing contents write", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: JSON.stringify([{ repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "pull_requests:write" }]) }, /contents:write is missing/],
    ["missing pull requests write", { GITHUB_SCRATCH_CONFIGURED_CAPABILITIES: JSON.stringify([{ repository: "Aayushashsahu/sentinelforge-incident-fixture", capability: "contents:write" }]) }, /pull_requests:write is missing/],
  ])("fails closed for %s", (_label, overrides, message) => {
    expect(() => parseLiveFixtureProofHarnessConfig(environment(overrides))).toThrow(message);
  });

  it("does not use ambient GitHub credential variables as a fallback", () => {
    const config = parseLiveFixtureProofHarnessConfig({ ...environment(), GH_TOKEN: "ambient", GITHUB_TOKEN: "ambient", GITHUB_READ_TOKEN: "ambient" });
    expect(config.token).toBe("secure-input-only-token");
  });
});
