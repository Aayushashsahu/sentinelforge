import { describe, expect, it } from "vitest";
import { assessConfiguredWriteCapability, GitHubWriteCapabilityPolicy } from "./githubWriteCapability";

const repository = "Aayushashsahu/sentinelforge-incident-fixture";
const contents = { repository, capability: "contents:write" as const };
const pullRequests = { repository, capability: "pull_requests:write" as const };

describe("configured fixture GitHub write-capability policy", () => {
  it("permits only an exact configured contents-write guard while keeping effective authority unverified", () => {
    const policy = new GitHubWriteCapabilityPolicy([contents, pullRequests]);
    expect(() => policy.require(repository, { capability: "contents:write", method: "POST", endpoint: "/git/refs" })).not.toThrow();
    expect(assessConfiguredWriteCapability([contents, pullRequests], repository, "contents:write")).toEqual({ configured: "VERIFIED", effective: "UNVERIFIED", fullPermissionManifest: "UNVERIFIABLE" });
  });

  it("permits only an exact configured pull-request-write guard", () => {
    expect(() => new GitHubWriteCapabilityPolicy([contents, pullRequests]).require(repository, { capability: "pull_requests:write", method: "POST", endpoint: "/pulls" })).not.toThrow();
  });

  it.each([
    ["missing configuration", [], repository, { capability: "contents:write", method: "POST", endpoint: "/git/refs" }, "MISSING_CONFIGURATION"],
    ["read-only configuration", [{ repository, capability: "contents:read" }], repository, { capability: "contents:write", method: "POST", endpoint: "/git/refs" }, "MISSING_CONFIGURATION"],
    ["wrong repository", [contents], "Aayushashsahu/other", { capability: "contents:write", method: "POST", endpoint: "/git/refs" }, "REPOSITORY_MISMATCH"],
    ["mismatched operation capability", [contents], repository, { capability: "pull_requests:write", method: "POST", endpoint: "/pulls" }, "MISSING_CONFIGURATION"],
  ])("blocks %s", (_label, configured, target, operation, reason) => {
    expect(() => new GitHubWriteCapabilityPolicy(configured as typeof contents[]).require(target, operation as { capability: "contents:write" | "pull_requests:write"; method: "POST"; endpoint: string })).toThrow(reason);
  });
});
