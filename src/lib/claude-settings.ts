import fs from "node:fs";
import path from "node:path";
import {
  CLAUDE_SETTINGS_PATH,
  LOCAL_CLAUDE_SETTINGS_PATH,
  HOOK_BINARY_NAME,
  HOOK_COMMAND,
  HOOK_MATCHER,
  VERSION_CHECK_SCRIPT_NAME,
  VERSION_CHECK_COMMAND,
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

export function getSettingsPath(local: boolean): string {
  return local ? LOCAL_CLAUDE_SETTINGS_PATH : CLAUDE_SETTINGS_PATH;
}

export function readSettings(settingsPath?: string): ClaudeSettings {
  const filePath = settingsPath ?? CLAUDE_SETTINGS_PATH;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function writeSettings(settings: ClaudeSettings, settingsPath?: string): void {
  const filePath = settingsPath ?? CLAUDE_SETTINGS_PATH;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
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

export function addHook(settings: ClaudeSettings, command?: string, version?: string): ClaudeSettings {
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.PreToolUse) {
    settings.hooks.PreToolUse = [];
  }

  const hookGroup: HookGroup & { version?: string } = {
    matcher: HOOK_MATCHER,
    hooks: [
      {
        type: "command",
        command: command ?? HOOK_COMMAND,
      },
    ],
  };

  if (version) {
    hookGroup.version = version;
  }

  settings.hooks.PreToolUse.push(hookGroup);

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

export function isVersionCheckInstalled(settings: ClaudeSettings): boolean {
  const sessionStart = settings.hooks?.SessionStart;
  if (!sessionStart) return false;

  return sessionStart.some((group) =>
    group.hooks.some((hook) => hook.command.includes(VERSION_CHECK_SCRIPT_NAME))
  );
}

export function addVersionCheckHook(settings: ClaudeSettings): ClaudeSettings {
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = [];
  }

  settings.hooks.SessionStart.push({
    hooks: [
      {
        type: "command",
        command: VERSION_CHECK_COMMAND,
      },
    ],
  });

  return settings;
}

export function removeVersionCheckHook(settings: ClaudeSettings): ClaudeSettings {
  // Remove from SessionStart (current) and PreSessionStart (legacy)
  for (const event of ["SessionStart", "PreSessionStart"] as const) {
    const groups = settings.hooks?.[event];
    if (!groups) continue;

    settings.hooks![event] = groups.filter(
      (group) =>
        !group.hooks.some((hook) => hook.command.includes(VERSION_CHECK_SCRIPT_NAME))
    );

    if (settings.hooks![event]!.length === 0) {
      delete settings.hooks![event];
    }
  }

  return settings;
}

export function getInstalledVersion(settings: ClaudeSettings): string | null {
  const preToolUse = settings.hooks?.PreToolUse;
  if (!preToolUse) return null;

  for (const group of preToolUse) {
    if (group.hooks.some((hook) => hook.command.includes(HOOK_BINARY_NAME))) {
      return (group as HookGroup & { version?: string }).version ?? null;
    }
  }

  return null;
}
