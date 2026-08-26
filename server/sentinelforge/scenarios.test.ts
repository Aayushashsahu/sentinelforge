import { describe, expect, it } from "vitest";
import { deterministicScenarioIds, getDeterministicScenario, runDeterministicScenarioVerification } from "./scenarios";
import { createRepairFingerprint, isValidRepairFingerprint } from "./liveContracts";

describe("deterministic incident scenarios", () => {
  it("keeps the release-manifest and CI workflow scenarios as distinct evidence-backed fixture paths", () => {
    expect(deterministicScenarioIds).toEqual(["release_manifest_version_drift", "workflow_node_version_mismatch"]);
    const scenario = getDeterministicScenario("workflow_node_version_mismatch");
    expect(scenario.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: "package.json", observation: "engines.node=>=20" }),
      expect.objectContaining({ file: ".github/workflows/ci.yml", observation: "actions/setup-node node-version=18" }),
    ]));
    expect(scenario.repairProposal.filesChanged).toEqual([".github/workflows/ci.yml"]);
    expect(scenario.repairProposal.patch).toContain("node-version: 20");
  });

  it("uses the canonical repair fingerprint and no-shell verifier expectation for the workflow scenario", async () => {
    const scenario = getDeterministicScenario("workflow_node_version_mismatch");
    expect(isValidRepairFingerprint(scenario.repairFingerprint)).toBe(true);
    expect(scenario.repairFingerprint).toBe(createRepairFingerprint({ summary: scenario.repairProposal.summary, patch: scenario.repairProposal.patch, files_changed: scenario.repairProposal.filesChanged, expected_effect: scenario.repairProposal.expectedEffect, risk: scenario.repairProposal.risk }));
    const run = await runDeterministicScenarioVerification(scenario.id);
    expect(run.result.status).toBe("PASS");
    expect(run.result.testsRun).toEqual(["workflow-node-compatibility :: ci.nodeMajor >= package.engines.node floor"]);
    expect(run.stdout).toContain("ci Node major (20) >= package engine floor (20)");
  });

  it("fails the workflow scenario closed when the proposal is withheld", async () => {
    const run = await runDeterministicScenarioVerification("workflow_node_version_mismatch", { forceFailure: true });
    expect(run.result.status).toBe("FAIL");
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("configured CI Node major 18");
  });
});
