import { describe, expect, it } from "vitest";
import { getTrueForgeRuntimeConfig } from "./trueforge/client";

const enabled = process.env.RUN_TRUEFORGE_ENDPOINT_VERIFICATION === "1";

describe.skipIf(!enabled)("configured TrueForge endpoint", () => {
  it("returns a successful model catalogue without creating a session or turn", async () => {
    const config = getTrueForgeRuntimeConfig();
    const response = await fetch(`${config.baseUrl}/api/v1/models`);
    expect(response.status).toBe(200);
    await response.arrayBuffer();
  }, 30_000);
});
