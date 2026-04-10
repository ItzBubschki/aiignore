import fs from "node:fs";
import {
  CLAUDE_SETTINGS_PATH,
  HOOK_BINARY_NAME,
  HOOK_INSTALL_PATH,
  HOOK_MATCHER,
} from "./constants.js";

interface HookEntry {
  type: string;
  command: string;
}

interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
}

interface ClaudeSettings {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

export function readSettings(): ClaudeSettings {
  try {
    const content = fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function writeSettings(settings: ClaudeSettings): void {
  fs.writeFileSync(
    CLAUDE_SETTINGS_PATH,
    JSON.stringify(settings, null, 2) + "\n",
    "utf-8"
  );
}

export function isHookInstalled(settings: ClaudeSettings): boolean {
  const preToolUse = settings.hooks?.PreToolUse;
  if (!preToolUse) return false;

  return preToolUse.some((group) =>
    group.hooks.some((hook) => hook.command.includes(HOOK_BINARY_NAME))
  );
}

export function addHook(settings: ClaudeSettings, command?: string): ClaudeSettings {
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.PreToolUse) {
    settings.hooks.PreToolUse = [];
  }

  settings.hooks.PreToolUse.push({
    matcher: HOOK_MATCHER,
    hooks: [
      {
        type: "command",
        command: command ?? HOOK_INSTALL_PATH,
      },
    ],
  });

  return settings;
}

export function removeHook(settings: ClaudeSettings): ClaudeSettings {
  const preToolUse = settings.hooks?.PreToolUse;
  if (!preToolUse) return settings;

  settings.hooks!.PreToolUse = preToolUse.filter(
    (group) =>
      !group.hooks.some((hook) => hook.command.includes(HOOK_BINARY_NAME))
  );

  if (settings.hooks!.PreToolUse.length === 0) {
    delete settings.hooks!.PreToolUse;
  }

  return settings;
}
