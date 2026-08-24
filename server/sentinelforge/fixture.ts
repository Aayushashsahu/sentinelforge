import type { InvestigationResult, RepairProposal, VerificationResult } from "../../shared/sentinelforge";

export const fixtureIncident = { repository: "sentinelforge-demo/broken-ci-fixture", title: "CI fails after the release manifest version drifted", incident: "The release-check job fails because package.json declares 1.0.1 while release-manifest.json still declares 1.0.0." };
const fixtureFiles = {
  "package.json": JSON.stringify({ name: "broken-ci-fixture", version: "1.0.1", scripts: { test: "node test.js" } }, null, 2),
  "release-manifest.json": JSON.stringify({ version: "1.0.0", channel: "stable" }, null, 2),
  "test.js": "assert package.version === manifest.version",
};

export const investigatorResult: InvestigationResult = { finding: "The release-check assertion compares package.json.version with release-manifest.json.version and observes a mismatch.", rootCause: "release-manifest.json was not updated when package.json advanced to 1.0.1.", confidence: 0.98, evidence: ["package.json: version=1.0.1", "release-manifest.json: version=1.0.0", "test.js: package.version must equal manifest.version"] };
export const repairProposal: RepairProposal = { summary: "Align the release manifest version with the package version.", filesChanged: ["release-manifest.json"], patch: "--- a/release-manifest.json\n+++ b/release-manifest.json\n@@\n-  \\\"version\\\": \\\"1.0.0\\\",\n+  \\\"version\\\": \\\"1.0.1\\\",", expectedEffect: "The release-check assertion will compare identical versions and the CI check will pass.", risk: "LOW" };

export type FixtureSandboxRun = { result: VerificationResult; stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean };

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Fixture verifier exceeded its execution bound.")), timeoutMs);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

/** A deliberately limited verifier. It runs no shell, generated code, network, or host-file operations. */
export async function runFixtureVerification({ forceFailure = false, forceTimeout = false }: { forceFailure?: boolean; forceTimeout?: boolean } = {}): Promise<FixtureSandboxRun> {
  const startedAt = Date.now();
  try {
    return await withTimeout(new Promise<FixtureSandboxRun>(resolve => {
      const delay = forceTimeout ? 160 : 30;
      setTimeout(() => {
        const manifest = JSON.parse(fixtureFiles["release-manifest.json"]);
        const packageFile = JSON.parse(fixtureFiles["package.json"]);
        const repairedManifest = { ...manifest, version: forceFailure ? manifest.version : packageFile.version };
        const passes = repairedManifest.version === packageFile.version;
        resolve({ result: { status: passes ? "PASS" : "FAIL", testsRun: ["release-check :: package.version === manifest.version"], testsPassed: passes ? 1 : 0, testsFailed: passes ? 0 : 1, evidence: passes ? ["release-manifest.json patched to 1.0.1", "release-check passed"] : ["release-manifest.json remained at 1.0.0", "release-check failed"] }, stdout: passes ? "[fixture-isolation] patched release-manifest.json\n[release-check] package.version (1.0.1) === manifest.version (1.0.1)\nPASS" : "[fixture-isolation] patch rejected by test fixture\nFAIL", stderr: passes ? "" : "AssertionError: expected package.version to equal manifest.version", exitCode: passes ? 0 : 1, durationMs: Date.now() - startedAt, timedOut: false });
      }, delay);
    }), 90);
  } catch (error) {
    return { result: { status: "TIMEOUT", testsRun: ["release-check :: package.version === manifest.version"], testsPassed: 0, testsFailed: 0, evidence: ["Fixture verifier timed out before completion."] }, stdout: "", stderr: error instanceof Error ? error.message : "Unknown timeout", exitCode: 124, durationMs: Date.now() - startedAt, timedOut: true };
  }
}
