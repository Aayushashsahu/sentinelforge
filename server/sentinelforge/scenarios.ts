import { createRepairFingerprint } from "./liveContracts";
import { fixtureIncident, investigatorResult, repairProposal, runDependencyCompatibilityFixtureVerification, runFixtureVerification, type FixtureSandboxRun } from "./fixture";
import type { InvestigationResult, RepairProposal, VerificationResult } from "../../shared/sentinelforge";

export const deterministicScenarioIds = ["release_manifest_version_drift", "workflow_node_version_mismatch", "dependency_plugin_major_mismatch"] as const;
export type DeterministicScenarioId = (typeof deterministicScenarioIds)[number];

type ScenarioVerification = {
  command: string;
  testsRun: readonly string[];
  passEvidence: readonly string[];
  failureEvidence: readonly string[];
  stdout: string;
  stderr: string;
  passedResult: string;
  approvalJustification: string;
};

export type DeterministicIncidentScenario = {
  id: DeterministicScenarioId;
  label: string;
  incident: { repository: string; title: string; incident: string };
  evidence: readonly { file: string; observation: string }[];
  investigatorResult: InvestigationResult;
  repairProposal: RepairProposal;
  repairFingerprint: string;
  verification: ScenarioVerification;
};

function fingerprint(proposal: RepairProposal): string {
  return createRepairFingerprint({ summary: proposal.summary, patch: proposal.patch, files_changed: proposal.filesChanged, expected_effect: proposal.expectedEffect, risk: proposal.risk });
}

const releaseManifestScenario: DeterministicIncidentScenario = {
  id: "release_manifest_version_drift",
  label: "Release manifest version drift",
  incident: fixtureIncident,
  evidence: [
    { file: "package.json", observation: "version=1.0.1" },
    { file: "release-manifest.json", observation: "version=1.0.0" },
    { file: "test.js", observation: "package.version must equal manifest.version" },
  ],
  investigatorResult,
  repairProposal,
  repairFingerprint: fingerprint(repairProposal),
  verification: {
    command: "release-check :: package.version === manifest.version",
    testsRun: ["release-check :: package.version === manifest.version"],
    passEvidence: ["release-manifest.json patched to 1.0.1", "release-check passed"],
    failureEvidence: ["release-manifest.json remained at 1.0.0", "release-check failed"],
    stdout: "[fixture-isolation] patched release-manifest.json\n[release-check] package.version (1.0.1) === manifest.version (1.0.1)\nPASS",
    stderr: "AssertionError: expected package.version to equal manifest.version",
    passedResult: "Release-check passed. The release-manifest repair is eligible for review, not for autonomous action.",
    approvalJustification: "Create a simulated pull-request record for the verified one-file release-manifest patch.",
  },
};

const workflowNodeProposal: RepairProposal = {
  summary: "Align the CI workflow Node.js version with the declared package engine floor.",
  filesChanged: [".github/workflows/ci.yml"],
  patch: "--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n@@\n-          node-version: 18\n+          node-version: 20",
  expectedEffect: "The CI job will provision Node.js 20, satisfying package.json engines.node >=20 before running the deterministic compatibility check.",
  risk: "LOW",
};

const workflowNodeScenario: DeterministicIncidentScenario = {
  id: "workflow_node_version_mismatch",
  label: "CI workflow Node.js compatibility mismatch",
  incident: {
    repository: "sentinelforge-demo/workflow-compatibility-fixture",
    title: "CI uses a Node.js version below the declared package requirement",
    incident: "The CI workflow installs Node.js 18 while package.json requires Node.js 20 or later, so the test job is incompatible with the project runtime contract.",
  },
  evidence: [
    { file: "package.json", observation: "engines.node=>=20" },
    { file: ".github/workflows/ci.yml", observation: "actions/setup-node node-version=18" },
    { file: "test.js", observation: "CI Node major must meet the package engine floor" },
  ],
  investigatorResult: {
    finding: "The CI workflow provisions Node.js 18 although package.json declares engines.node >=20, violating the repository's runtime compatibility contract.",
    rootCause: ".github/workflows/ci.yml retained node-version 18 after the package engine floor advanced to Node.js 20.",
    confidence: 0.99,
    evidence: ["package.json: engines.node=>=20", ".github/workflows/ci.yml: node-version=18", "test.js: configured CI Node major must meet the declared engine floor"],
  },
  repairProposal: workflowNodeProposal,
  repairFingerprint: fingerprint(workflowNodeProposal),
  verification: {
    command: "workflow-node-compatibility :: ci.nodeMajor >= package.engines.node floor",
    testsRun: ["workflow-node-compatibility :: ci.nodeMajor >= package.engines.node floor"],
    passEvidence: [".github/workflows/ci.yml patched to node-version 20", "workflow-node-compatibility passed"],
    failureEvidence: [".github/workflows/ci.yml remained on node-version 18", "workflow-node-compatibility failed"],
    stdout: "[fixture-isolation] patched .github/workflows/ci.yml\n[workflow-node-compatibility] ci Node major (20) >= package engine floor (20)\nPASS",
    stderr: "CompatibilityError: configured CI Node major 18 is below required engine floor 20",
    passedResult: "Workflow Node compatibility passed. The CI configuration repair is eligible for review, not for autonomous action.",
    approvalJustification: "Create a simulated pull-request record for the verified one-file CI workflow configuration patch.",
  },
};

const dependencyPluginProposal: RepairProposal = {
  summary: "Align the compatibility manifest with the installed plugin major version.",
  filesChanged: [".sentinelforge/compatibility.json"],
  patch: "--- a/.sentinelforge/compatibility.json\n+++ b/.sentinelforge/compatibility.json\n@@\n-  \"supportedPluginMajor\": 2\n+  \"supportedPluginMajor\": 3",
  expectedEffect: "The compatibility manifest will declare support for the installed plugin major version before the deterministic dependency-compatibility check runs.",
  risk: "LOW",
};

const dependencyPluginScenario: DeterministicIncidentScenario = {
  id: "dependency_plugin_major_mismatch",
  label: "Dependency plugin major compatibility mismatch",
  incident: {
    repository: "sentinelforge-demo/dependency-compatibility-fixture",
    title: "Dependency plugin major exceeds the compatibility manifest",
    incident: "package.json installs the Sentinel plugin major version 3 while the compatibility manifest still accepts major version 2, so the deterministic compatibility check refuses the release.",
  },
  evidence: [
    { file: "package.json", observation: "dependencies.sentinel-plugin=^3.2.0" },
    { file: ".sentinelforge/compatibility.json", observation: "supportedPluginMajor=2" },
    { file: "test.js", observation: "installed plugin major must equal compatibility manifest major" },
  ],
  investigatorResult: {
    finding: "The package dependency resolves the Sentinel plugin major version 3 while the compatibility manifest declares support for major version 2.",
    rootCause: ".sentinelforge/compatibility.json was not updated after sentinel-plugin advanced from major version 2 to major version 3.",
    confidence: 0.99,
    evidence: ["package.json: dependencies.sentinel-plugin=^3.2.0", ".sentinelforge/compatibility.json: supportedPluginMajor=2", "test.js: installed plugin major must equal compatibility manifest major"],
  },
  repairProposal: dependencyPluginProposal,
  repairFingerprint: fingerprint(dependencyPluginProposal),
  verification: {
    command: "dependency-compatibility :: installed.pluginMajor === compatibility.supportedPluginMajor",
    testsRun: ["dependency-compatibility :: installed.pluginMajor === compatibility.supportedPluginMajor"],
    passEvidence: [".sentinelforge/compatibility.json patched to supportedPluginMajor 3", "dependency-compatibility passed"],
    failureEvidence: [".sentinelforge/compatibility.json remained on supportedPluginMajor 2", "dependency-compatibility failed"],
    stdout: "[fixture-isolation] patched .sentinelforge/compatibility.json\n[dependency-compatibility] installed plugin major (3) === supported major (3)\nPASS",
    stderr: "CompatibilityError: installed plugin major 3 does not match supported major 2",
    passedResult: "Dependency compatibility passed. The compatibility-manifest repair is eligible for review, not for autonomous action.",
    approvalJustification: "Create a simulated pull-request record for the verified one-file dependency compatibility manifest patch.",
  },
};

export const deterministicScenarios: Record<DeterministicScenarioId, DeterministicIncidentScenario> = {
  release_manifest_version_drift: releaseManifestScenario,
  workflow_node_version_mismatch: workflowNodeScenario,
  dependency_plugin_major_mismatch: dependencyPluginScenario,
};

export function getDeterministicScenario(id: DeterministicScenarioId = "release_manifest_version_drift"): DeterministicIncidentScenario {
  return deterministicScenarios[id];
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Fixture verifier exceeded its execution bound.")), timeoutMs);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

/** The scenario verifier remains deterministic: it never invokes a shell, network, filesystem, sandbox, or host process. */
export async function runDeterministicScenarioVerification(scenarioId: DeterministicScenarioId, { forceFailure = false, forceTimeout = false }: { forceFailure?: boolean; forceTimeout?: boolean } = {}): Promise<FixtureSandboxRun> {
  if (scenarioId === "release_manifest_version_drift") return runFixtureVerification({ forceFailure, forceTimeout });
  if (scenarioId === "dependency_plugin_major_mismatch") return runDependencyCompatibilityFixtureVerification({ forceFailure, forceTimeout });
  const scenario = getDeterministicScenario(scenarioId);
  const startedAt = Date.now();
  try {
    return await withTimeout(new Promise<FixtureSandboxRun>(resolve => {
      setTimeout(() => {
        const passes = !forceFailure;
        resolve({
          result: { status: passes ? "PASS" : "FAIL", testsRun: [...scenario.verification.testsRun], testsPassed: passes ? 1 : 0, testsFailed: passes ? 0 : 1, evidence: passes ? [...scenario.verification.passEvidence] : [...scenario.verification.failureEvidence] },
          stdout: passes ? scenario.verification.stdout : "[fixture-isolation] repair not applied\nFAIL",
          stderr: passes ? "" : scenario.verification.stderr,
          exitCode: passes ? 0 : 1,
          durationMs: Date.now() - startedAt,
          timedOut: false,
        });
      }, forceTimeout ? 160 : 30);
    }), 90);
  } catch (error) {
    return { result: { status: "TIMEOUT", testsRun: [...scenario.verification.testsRun], testsPassed: 0, testsFailed: 0, evidence: ["Fixture verifier timed out before completion."] }, stdout: "", stderr: error instanceof Error ? error.message : "Unknown timeout", exitCode: 124, durationMs: Date.now() - startedAt, timedOut: true };
  }
}
