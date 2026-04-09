import path from "node:path";
import os from "node:os";

export const HOOK_BINARY_NAME = "ai-guard-hook";
export const HOOKS_DIR = path.join(os.homedir(), ".claude", "hooks");
export const HOOK_INSTALL_PATH = path.join(HOOKS_DIR, HOOK_BINARY_NAME);
export const CLAUDE_SETTINGS_PATH = path.join(
  os.homedir(),
  ".claude",
  "settings.json"
);
export const AIIGNORE_FILENAME = ".aiignore";
export const GLOBAL_AIIGNORE_PATH = path.join(os.homedir(), AIIGNORE_FILENAME);
export const HOOK_MATCHER = "Read|Write|Edit|MultiEdit";
