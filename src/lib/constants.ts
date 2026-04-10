import path from "node:path";
import os from "node:os";

export const HOOK_BINARY_NAME = "ai-guard-hook";
export const HOOKS_DIR = path.join(os.homedir(), ".claude", "hooks");
export const LOCAL_HOOKS_DIR = path.join(process.cwd(), ".claude", "hooks");
export const HOOK_INSTALL_PATH = path.join(HOOKS_DIR, HOOK_BINARY_NAME);
export const LOCAL_HOOK_INSTALL_PATH = path.join(LOCAL_HOOKS_DIR, HOOK_BINARY_NAME);
export const HOOK_SCRIPT_INSTALL_PATH = path.join(HOOKS_DIR, `${HOOK_BINARY_NAME}.js`);
export const LOCAL_HOOK_SCRIPT_INSTALL_PATH = path.join(LOCAL_HOOKS_DIR, `${HOOK_BINARY_NAME}.js`);
export const CLAUDE_SETTINGS_PATH = path.join(
  os.homedir(),
  ".claude",
  "settings.json"
);
export const LOCAL_CLAUDE_SETTINGS_PATH = path.join(
  process.cwd(),
  ".claude",
  "settings.json"
);
export const AIIGNORE_FILENAME = ".aiignore";
export const GLOBAL_AIIGNORE_PATH = path.join(os.homedir(), AIIGNORE_FILENAME);
export const HOOK_MATCHER = "Read|Write|Edit|MultiEdit";
export const VERSION_CHECK_SCRIPT_NAME = "version-check.js";
export const VERSION_CHECK_INSTALL_PATH = path.join(HOOKS_DIR, VERSION_CHECK_SCRIPT_NAME);
export const LOCAL_VERSION_CHECK_INSTALL_PATH = path.join(LOCAL_HOOKS_DIR, VERSION_CHECK_SCRIPT_NAME);
export const AUDIT_LOG_PATH = path.join(os.homedir(), ".claude", "aiignore-audit.log");
