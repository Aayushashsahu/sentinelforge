import { describe, expect, it } from "vitest";

const runLiveTokenValidation = process.env.RUN_GITHUB_READ_TOKEN_VALIDATION === "1";

describe.skipIf(!runLiveTokenValidation)("server-only GitHub read token", () => {
  it("authenticates to the lightweight rate-limit endpoint without disclosing the token", async () => {
    const token = process.env.GITHUB_READ_TOKEN?.trim();
    expect(token).toBeTruthy();

    const response = await fetch("https://api.github.com/rate_limit", {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
      signal: AbortSignal.timeout(12_000),
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as { resources?: { core?: { limit?: number } } };
    expect(payload.resources?.core?.limit).toBeGreaterThan(0);
  }, 15_000);
});
