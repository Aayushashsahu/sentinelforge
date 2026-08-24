export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  trueForgeBaseUrl: process.env.TRUEFORGE_BASE_URL?.trim() ?? "",
  trueForgeToken: process.env.TRUEFORGE_TOKEN?.trim() || undefined,
  trueForgeModel: process.env.TRUEFORGE_MODEL?.trim() ?? "",
  trueForgeGithubMcpName: process.env.TRUEFORGE_GITHUB_MCP_NAME?.trim() ?? "",
};
