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

export const SANDBOX_REPAIR_VERIFICATION_COMMAND = `set -eu
workdir="$(mktemp -d)"
cat > "$workdir/package.json" <<'JSON'
{"version":"1.4.0"}
JSON
cat > "$workdir/release-manifest.json" <<'JSON'
{"version":"1.4.0"}
JSON
python3 - "$workdir" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
package = json.loads((root / "package.json").read_text())
manifest = json.loads((root / "release-manifest.json").read_text())
assert manifest["version"] == "1.4.0", manifest
assert manifest["version"] == package["version"], (manifest, package)
print("sentinelforge-release-manifest-verifier: PASS")
PY`;

export function buildSandboxRepairVerificationSpec(model: string): TrueForgeInlineAgentSpec {
  return {
    model: { name: model },
    instructions: [
      "You are a bounded isolated verification agent.",
      "Use the TrueForge sandbox exactly once and do not use MCP, GitHub, network access, credentials, or host resources.",
      "Inside the sandbox only, create the two fixture JSON files and apply the already approved release-manifest repair by executing exactly the following command.",
      SANDBOX_REPAIR_VERIFICATION_COMMAND,
      "Report the exact sandbox stdout, stderr, and exit code. Do not claim a pass unless the command really ran and printed the verifier PASS marker.",
    ].join("\n\n"),
    config: {
      iteration_limit: 1,
      sandbox: { enabled: true, file_downloads: false },
      dynamic_sub_agents: { enabled: false },
      ask_user_questions: { enabled: false },
    },
  };
}
