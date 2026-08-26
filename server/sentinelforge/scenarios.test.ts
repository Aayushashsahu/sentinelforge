import { describe, expect, it } from "vitest";
import { deterministicScenarioIds, getDeterministicScenario, runDeterministicScenarioVerification } from "./scenarios";
import { createRepairFingerprint, isValidRepairFingerprint } from "./liveContracts";

describe("deterministic incident scenarios", () => {
  it("keeps the release-manifest and CI workflow scenarios as distinct evidence-backed fixture paths", () => {
    expect(deterministicScenarioIds).toEqual(["release_manifest_version_drift", "workflow_node_version_mismatch", "dependency_plugin_major_mismatch"]);
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
    expect(scenario.verification.passedResult).toContain("Workflow Node compatibility passed");
    expect(scenario.verification.approvalJustification).toContain("CI workflow configuration patch");
  });

  it("fails the workflow scenario closed when the proposal is withheld", async () => {
    const run = await runDeterministicScenarioVerification("workflow_node_version_mismatch", { forceFailure: true });
    expect(run.result.status).toBe("FAIL");
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("configured CI Node major 18");
  });

  it("models dependency plugin compatibility as a distinct evidence-backed scenario with a canonical repair fingerprint", async () => {
    const scenario = getDeterministicScenario("dependency_plugin_major_mismatch");
    expect(scenario.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: "package.json", observation: "dependencies.sentinel-plugin=^3.2.0" }),
      expect.objectContaining({ file: ".sentinelforge/compatibility.json", observation: "supportedPluginMajor=2" }),
    ]));
    expect(scenario.repairProposal.filesChanged).toEqual([".sentinelforge/compatibility.json"]);
    expect(scenario.repairProposal.patch).toContain("supportedPluginMajor\": 3");
    expect(isValidRepairFingerprint(scenario.repairFingerprint)).toBe(true);
    const run = await runDeterministicScenarioVerification(scenario.id);
    expect(run.result.status).toBe("PASS");
    expect(run.stdout).toContain("installed plugin major (3) === supported major (3)");
  });
});
