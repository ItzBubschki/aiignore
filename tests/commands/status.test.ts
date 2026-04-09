import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  spyOn,
  mock,
} from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let tmpDir: string;
let logOutput: string[];
let mockSettings: Record<string, unknown> = {};
let mockHookInstalled = false;
let mockHookBinaryPath = "/tmp/nonexistent-hook-binary";

mock.module("../../src/lib/claude-settings.js", () => ({
  readSettings: () => mockSettings,
  isHookInstalled: () => mockHookInstalled,
  writeSettings: () => {},
}));

mock.module("../../src/lib/constants.js", () => ({
  HOOK_INSTALL_PATH: mockHookBinaryPath,
  HOOK_BINARY_NAME: "ai-guard-hook",
  AIIGNORE_FILENAME: ".aiignore",
  HOOKS_DIR: "/tmp/hooks",
  CLAUDE_SETTINGS_PATH: "/tmp/settings.json",
}));

mock.module("../../src/lib/completions.js", () => ({
  getCompletionsStatus: () => ({ installed: false, shell: null, path: null }),
}));

const { status } = await import("../../src/commands/status.js");

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "status-test-"));
  mockSettings = {};
  mockHookInstalled = false;
  mockHookBinaryPath = "/tmp/nonexistent-hook-binary";

  spyOn(process, "cwd").mockReturnValue(tmpDir);
  logOutput = [];
  spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logOutput.push(args.join(" "));
  });
});

afterEach(() => {
  (process.cwd as ReturnType<typeof spyOn>).mockRestore();
  (console.log as ReturnType<typeof spyOn>).mockRestore();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("status", () => {
  it("shows hook not registered when not installed", async () => {
    mockHookInstalled = false;

    await status();
    const output = logOutput.join("\n");
    expect(output).toContain("Not found in settings");
  });

  it("shows hook registered when installed", async () => {
    mockHookInstalled = true;

    await status();
    const output = logOutput.join("\n");
    expect(output).toContain("~/.claude/settings.json");
  });

  it("shows no .aiignore when file does not exist", async () => {
    await status();
    const output = logOutput.join("\n");
    expect(output).toContain("No .aiignore in current directory");
  });

  it("shows .aiignore with pattern count when file exists", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".aiignore"),
      ".env\n*.secret\n# comment\n\nsecrets/\n"
    );

    await status();
    const output = logOutput.join("\n");
    expect(output).toContain("3 patterns");
  });

  it("shows singular pattern for single-pattern .aiignore", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");

    await status();
    const output = logOutput.join("\n");
    expect(output).toContain("1 pattern)");
  });

  it("shows install prompt when hook is not set up", async () => {
    mockHookInstalled = false;

    await status();
    const output = logOutput.join("\n");
    expect(output).toContain("aiignore install");
  });
});
