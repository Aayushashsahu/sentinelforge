import { describe, expect, it } from "vitest";
import { FIXTURE_PROOF_PROVIDER_APPROVAL_CONTENT, FIXTURE_PROOF_PROVIDER_APPROVAL_TITLE, FIXTURE_PROOF_PROVIDER_EVIDENCE_SOURCE } from "./liveFixtureProofCapture";

describe("fixture proof audit attribution", () => {
  it("labels only the gate and genuine approval pause as provider evidence without attributing mandatory artifact reads to the provider", () => {
    expect(FIXTURE_PROOF_PROVIDER_EVIDENCE_SOURCE).toBe("PROVIDER");
    expect(FIXTURE_PROOF_PROVIDER_APPROVAL_TITLE).toContain("provider");
    expect(FIXTURE_PROOF_PROVIDER_APPROVAL_CONTENT).toContain("Server-orchestrated fixture evidence had already verified package.json version 1.4.0");
    expect(FIXTURE_PROOF_PROVIDER_APPROVAL_CONTENT).toContain("The provider then invoked fixture_github_pr_gate and emitted a genuine tool.approval_required event.");
    expect(FIXTURE_PROOF_PROVIDER_APPROVAL_CONTENT).toContain("No provider MCP file read");
    expect(FIXTURE_PROOF_PROVIDER_APPROVAL_CONTENT).not.toContain("after the required package.json and release-manifest.json read calls");
  });
});
