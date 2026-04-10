import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { list } from "../../src/commands/list.js";

const PROJECT_ROOT = path.resolve(import.meta.dir, "../..");

function runList(
  cwd: string
): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync(
    ["bun", path.join(PROJECT_ROOT, "src/cli.ts"), "list"],
    {
      cwd,
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

describe("list command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiignore-list-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("shows message when no patterns exist", () => {
    const result = runList(tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No patterns configured");
  });

  test("shows local patterns", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".aiignore"),
      ".env\nsecrets/\n*.key\n"
    );
    const result = runList(tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("3 patterns");
    expect(result.stdout).toContain(".env");
    expect(result.stdout).toContain("secrets/");
    expect(result.stdout).toContain("*.key");
  });

  test("ignores comments and blank lines in count", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".aiignore"),
      "# This is a comment\n\n.env\n\n# Another comment\nsecrets/\n"
    );
    const result = runList(tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("2 patterns");
  });

  // Note: Global ~/.aiignore tests are skipped because os.homedir() cannot be
  // reliably overridden in bun subprocesses. Global list behavior should be
  // verified manually by creating ~/.aiignore and running `aiignore list`.
});
