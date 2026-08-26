import { describe, expect, it } from "vitest";
import { getTrueForgeRuntimeConfig } from "./trueforge/client";

const enabled = process.env.RUN_TRUEFORGE_ENDPOINT_CONFIG_CHECK === "1";
const expected = "https://trueforge.octiqai.com";

describe.skipIf(!enabled)("configured TrueForge endpoint normalization", () => {
  it("uses the supplied server-only endpoint exactly before any network request", () => {
    expect(getTrueForgeRuntimeConfig().baseUrl).toBe(expected);
  });
});
