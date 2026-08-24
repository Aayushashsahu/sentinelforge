import type { TrueForgeInlineAgentSpec } from "../trueforge/client";

export function buildSandboxProbeSpec(model: string): TrueForgeInlineAgentSpec {
  return {
    model: { name: model },
    instructions: "You are a sandbox capability probe. Use the TrueForge sandbox exactly once to run the harmless command `printf sentinel-forge-sandbox-ok`. Do not access GitHub, network services, repositories, credentials, or files outside the sandbox. Reply with the literal command output and a concise status.",
    config: {
      iteration_limit: 4,
      sandbox: { enabled: true, file_downloads: false },
      dynamic_sub_agents: { enabled: false },
      ask_user_questions: { enabled: false },
    },
  };
}
