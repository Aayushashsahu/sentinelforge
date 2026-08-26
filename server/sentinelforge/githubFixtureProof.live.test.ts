/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { LIVE_FIXTURE_PROOF_OWNER, LIVE_FIXTURE_PROOF_REPO, parseLiveFixtureProofHarnessConfig, runLiveFixtureProofHarness } from "./fixtureProofLiveHarness";

const enabled = process.env.RUN_LIVE_FIXTURE_GITHUB_PROOF === "1";

describe.skipIf(!enabled)("opt-in approval-gated live fixture GitHub proof", () => {
  it("uses the existing SentinelForge workflow to create at most one open, unmerged fixture PR", async () => {
    const config = parseLiveFixtureProofHarnessConfig(process.env);
    expect(config.owner).toBe(LIVE_FIXTURE_PROOF_OWNER);
    expect(config.repo).toBe(LIVE_FIXTURE_PROOF_REPO);
    const result = await runLiveFixtureProofHarness(config);
    expect(result.action.intent.repository).toBe(`${LIVE_FIXTURE_PROOF_OWNER}/${LIVE_FIXTURE_PROOF_REPO}`);
    expect(result.action.intent.baseBranch).toBe("main");
    expect(result.action.intent.filePath).toBe("release-manifest.json");
    expect(result.action.intent.beforeVersion).toBe("1.3.0");
    expect(result.action.intent.afterVersion).toBe("1.4.0");
    expect(result.action.status).toBe("PR_CREATED");
    expect(result.action.remote.pullRequestUrl).toMatch(/^https:\/\/github\.com\/Aayushashsahu\/sentinelforge-incident-fixture\/pull\/\d+$/);
  }, 240_000);
});
