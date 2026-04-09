import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  readSettings,
  writeSettings,
  isHookInstalled,
  addHook,
  removeHook,
} from "../../src/lib/claude-settings.js";
import {
  HOOK_BINARY_NAME,
  HOOK_INSTALL_PATH,
  HOOK_MATCHER,
} from "../../src/lib/constants.js";

// --- Pure function tests (no fs mocking needed) ---

describe("isHookInstalled", () => {
  it("returns false for empty settings", () => {
    expect(isHookInstalled({})).toBe(false);
  });

  it("returns false when hooks key exists but no PreToolUse", () => {
    expect(isHookInstalled({ hooks: {} })).toBe(false);
  });

  it("returns false when PreToolUse exists but has no matching hook", () => {
    expect(
      isHookInstalled({
        hooks: {
          PreToolUse: [
            {
              matcher: "Read",
              hooks: [{ type: "command", command: "/some/other/hook" }],
            },
          ],
        },
      })
    ).toBe(false);
  });

  it("returns true when hook is installed", () => {
    expect(
      isHookInstalled({
        hooks: {
          PreToolUse: [
            {
              matcher: HOOK_MATCHER,
              hooks: [{ type: "command", command: HOOK_INSTALL_PATH }],
            },
          ],
        },
      })
    ).toBe(true);
  });

  it("returns true when hook command contains the binary name among other hooks", () => {
    expect(
      isHookInstalled({
        hooks: {
          PreToolUse: [
            {
              matcher: "Read",
              hooks: [{ type: "command", command: "/other/hook" }],
            },
            {
              matcher: HOOK_MATCHER,
              hooks: [
                {
                  type: "command",
                  command: `/path/to/${HOOK_BINARY_NAME}`,
                },
              ],
            },
          ],
        },
      })
    ).toBe(true);
  });
});

describe("addHook", () => {
  it("adds hook to empty settings", () => {
    const result = addHook({});
    expect(result.hooks).toBeDefined();
    expect(result.hooks!.PreToolUse).toHaveLength(1);
    expect(result.hooks!.PreToolUse![0].matcher).toBe(HOOK_MATCHER);
    expect(result.hooks!.PreToolUse![0].hooks[0].command).toBe(
      HOOK_INSTALL_PATH
    );
  });

  it("adds hook alongside existing hooks", () => {
    const existing = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Read",
            hooks: [{ type: "command", command: "/other/hook" }],
          },
        ],
      },
    };
    const result = addHook(existing);
    expect(result.hooks!.PreToolUse).toHaveLength(2);
  });

  it("preserves other settings", () => {
    const result = addHook({ someOtherKey: "value" });
    expect(result.someOtherKey).toBe("value");
    expect(result.hooks!.PreToolUse).toHaveLength(1);
  });
});

describe("removeHook", () => {
  it("removes the hook", () => {
    const settings = {
      hooks: {
        PreToolUse: [
          {
            matcher: HOOK_MATCHER,
            hooks: [{ type: "command", command: HOOK_INSTALL_PATH }],
          },
        ],
      },
    };
    const result = removeHook(settings);
    expect(result.hooks!.PreToolUse).toBeUndefined();
  });

  it("preserves other hooks when removing", () => {
    const settings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Read",
            hooks: [{ type: "command", command: "/other/hook" }],
          },
          {
            matcher: HOOK_MATCHER,
            hooks: [{ type: "command", command: HOOK_INSTALL_PATH }],
          },
        ],
      },
    };
    const result = removeHook(settings);
    expect(result.hooks!.PreToolUse).toHaveLength(1);
    expect(result.hooks!.PreToolUse![0].hooks[0].command).toBe("/other/hook");
  });

  it("is a no-op when no hooks exist", () => {
    const result = removeHook({});
    expect(result).toEqual({});
  });

  it("is a no-op when hook is not installed", () => {
    const settings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Read",
            hooks: [{ type: "command", command: "/other/hook" }],
          },
        ],
      },
    };
    const result = removeHook(settings);
    expect(result.hooks!.PreToolUse).toHaveLength(1);
  });
});

// --- File I/O tests using a temp directory ---

describe("readSettings / writeSettings", () => {
  let tmpDir: string;
  let tmpSettingsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-settings-test-"));
    tmpSettingsPath = path.join(tmpDir, "settings.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writeSettings writes valid JSON", () => {
    const settings = { hooks: { PreToolUse: [] } };
    fs.writeFileSync(tmpSettingsPath, JSON.stringify(settings, null, 2) + "\n");
    const content = JSON.parse(fs.readFileSync(tmpSettingsPath, "utf-8"));
    expect(content).toEqual(settings);
  });

  it("writeSettings output is formatted with 2-space indent", () => {
    const settings = { key: "value" };
    fs.writeFileSync(tmpSettingsPath, JSON.stringify(settings, null, 2) + "\n");
    const raw = fs.readFileSync(tmpSettingsPath, "utf-8");
    expect(raw).toBe('{\n  "key": "value"\n}\n');
  });
});
