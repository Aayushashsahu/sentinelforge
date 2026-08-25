import { describe, expect, it } from "vitest";
import { verifyIncidentFixtureDeterministically } from "./verifier";

describe("incident fixture verifier abstraction", () => {
  it("reports a deterministic PASS without claiming a live sandbox run", () => {
    const outcome = verifyIncidentFixtureDeterministically({ packageVersion: "1.4.0", manifestVersion: "1.3.0", proposedManifestVersion: "1.4.0" });
    expect(outcome.mode).toBe("DETERMINISTIC_FIXTURE");
    expect(outcome.result.status).toBe("PASS");
    expect(outcome.didExecuteSandbox).toBe(false);
  });

  it("fails the deterministic verifier when the proposed manifest remains mismatched", () => {
    const outcome = verifyIncidentFixtureDeterministically({ packageVersion: "1.4.0", manifestVersion: "1.3.0", proposedManifestVersion: "1.3.0" });
    expect(outcome.result.status).toBe("FAIL");
    expect(outcome.didExecuteSandbox).toBe(false);
  });
});
