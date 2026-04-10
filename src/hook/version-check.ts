import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PACKAGE_NAME = "@aiignore/cli";
const HOOK_BINARY_NAME = "ai-guard-hook";
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const VERSION_CHECK_TIMEOUT = 2000;

interface HookEntry {
  type: string;
  command: string;
}

interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
  version?: string;
}

interface ClaudeSettings {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

function getInstalledVersion(): string | null {
  try {
    const content = fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf-8");
    const settings: ClaudeSettings = JSON.parse(content);
    const preToolUse = settings.hooks?.PreToolUse;
    if (!preToolUse) return null;

    for (const group of preToolUse) {
      if (group.hooks.some((h) => h.command.includes(HOOK_BINARY_NAME))) {
        return group.version ?? null;
      }
    }
  } catch {
    // Can't read settings
  }

  // Also check local settings
  try {
    const localPath = path.join(process.cwd(), ".claude", "settings.json");
    const content = fs.readFileSync(localPath, "utf-8");
    const settings: ClaudeSettings = JSON.parse(content);
    const preToolUse = settings.hooks?.PreToolUse;
    if (!preToolUse) return null;

    for (const group of preToolUse) {
      if (group.hooks.some((h) => h.command.includes(HOOK_BINARY_NAME))) {
        return group.version ?? null;
      }
    }
  } catch {
    // Can't read local settings
  }

  return null;
}

async function fetchLatestVersion(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT);

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${PACKAGE_NAME}/latest`,
      { signal: controller.signal }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as { version: string };
    return data.version;
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  // Consume stdin (required by Claude Code hook protocol)
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }

  const installed = getInstalledVersion();
  if (!installed) {
    process.exit(0);
  }

  const latest = await fetchLatestVersion();

  if (installed !== latest) {
    // Output to stdout — Claude Code surfaces this as context
    process.stdout.write(
      `aiignore update available: v${installed} → v${latest}. ` +
        `Run \`npx @aiignore/cli@latest install\` to update.\n`
    );
  }

  process.exit(0);
}

main().catch(() => {
  // Fail-open: never block session start
  process.exit(0);
});
