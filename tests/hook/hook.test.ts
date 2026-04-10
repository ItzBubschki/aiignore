import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOOK_SCRIPT = path.resolve(
  import.meta.dir,
  "../../src/hook/index.ts"
);

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runHook(
  filePath: string,
  cwd: string
): { exitCode: number; stderr: string } {
  const input = JSON.stringify({
    tool_input: { file_path: filePath },
  });

  try {
    execSync(`echo '${input}' | bun ${HOOK_SCRIPT}`, {
      cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10_000,
    });
    return { exitCode: 0, stderr: "" };
  } catch (err: any) {
    return {
      exitCode: err.status ?? 1,
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

describe("hook", () => {
  test("blocks file matching local .aiignore", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\nsecrets/\n");
    fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=abc");

    const result = runHook(".env", tmpDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("BLOCKED by .aiignore");
    expect(result.stderr).toContain(".env");
  });

  test("allows file not matching .aiignore", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\nsecrets/\n");
    fs.writeFileSync(path.join(tmpDir, "readme.txt"), "hello");

    const result = runHook("readme.txt", tmpDir);
    expect(result.exitCode).toBe(0);
  });

  test("allows everything when no .aiignore exists", () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=abc");

    const result = runHook(".env", tmpDir);
    expect(result.exitCode).toBe(0);
  });

  test("blocks file matching .aiignore in parent directory", () => {
    // Create nested structure: tmpDir/.aiignore and tmpDir/child/
    const child = path.join(tmpDir, "child");
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.secret\n");
    fs.writeFileSync(path.join(child, "data.secret"), "sensitive");

    const result = runHook("data.secret", child);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("BLOCKED");
    expect(result.stderr).toContain("data.secret");
  });

  test("blocks file matching .aiignore two levels up", () => {
    const grandchild = path.join(tmpDir, "a", "b");
    fs.mkdirSync(grandchild, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    fs.writeFileSync(path.join(grandchild, ".env"), "SECRET=abc");

    const result = runHook(".env", grandchild);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("BLOCKED");
  });

  test("allows file not matching any parent .aiignore", () => {
    const child = path.join(tmpDir, "child");
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.secret\n");
    fs.writeFileSync(path.join(child, "readme.txt"), "hello");

    const result = runHook("readme.txt", child);
    expect(result.exitCode).toBe(0);
  });

  test("closer .aiignore can block even without parent", () => {
    const child = path.join(tmpDir, "child");
    fs.mkdirSync(child, { recursive: true });
    // No .aiignore in tmpDir, but one in child
    fs.writeFileSync(path.join(child, ".aiignore"), ".env\n");
    fs.writeFileSync(path.join(child, ".env"), "SECRET=abc");

    const result = runHook(".env", child);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("BLOCKED");
  });

  test("stderr shows relative path to parent .aiignore", () => {
    const child = path.join(tmpDir, "child");
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.secret\n");

    const result = runHook("data.secret", child);
    expect(result.exitCode).toBe(2);
    // The message should reference the parent .aiignore with a relative path
    expect(result.stderr).toContain("../.aiignore");
  });

  test("blocks file matching global ~/.aiignore", () => {
    // The test preload sets HOME to an isolated temp dir, so we can safely
    // write to ~/.aiignore without touching the user's real global blocklist.
    const globalAiignore = path.join(os.homedir(), ".aiignore");
    fs.writeFileSync(globalAiignore, "*.secret\n");

    try {
      const result = runHook("test.secret", tmpDir);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("BLOCKED by ~/.aiignore (global)");
    } finally {
      fs.unlinkSync(globalAiignore);
    }
  });
});
