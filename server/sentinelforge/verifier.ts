import type { VerificationResult } from "../../shared/sentinelforge";

export type IncidentFixtureVerifierInput = {
  packageVersion: string;
  manifestVersion: string;
  proposedManifestVersion: string;
};

export type VerifierExecution = {
  mode: "DETERMINISTIC_FIXTURE";
  result: VerificationResult;
  stdout: string;
  stderr: string;
  exitCode: number;
  didExecuteSandbox: false;
};

/**
 * A pure, no-shell verifier for the public incident fixture. It is deliberately
 * not a claim that a live TrueForge sandbox executed the test.
 */
export function verifyIncidentFixtureDeterministically(input: IncidentFixtureVerifierInput): VerifierExecution {
  const pass = input.packageVersion === input.proposedManifestVersion;
  const expected = `package.json=${input.packageVersion}, release-manifest.json=${input.proposedManifestVersion}`;
  return {
    mode: "DETERMINISTIC_FIXTURE",
    result: {
      status: pass ? "PASS" : "FAIL",
      testsRun: ["release-check :: package.version === manifest.version"],
      testsPassed: pass ? 1 : 0,
      testsFailed: pass ? 0 : 1,
      evidence: pass
        ? [`Proposed manifest version matches package version: ${expected}`, "Deterministic fixture verifier passed; live sandbox execution was not used."]
        : [`Proposed manifest version does not match package version: ${expected}`, "Deterministic fixture verifier failed; live sandbox execution was not used."],
    },
    stdout: pass ? `[deterministic-fixture] ${expected}\nPASS` : "",
    stderr: pass ? "" : `[deterministic-fixture] ${expected}\nFAIL`,
    exitCode: pass ? 0 : 1,
    didExecuteSandbox: false,
  };
}
