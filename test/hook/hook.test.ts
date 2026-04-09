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

// Use a subdirectory as the project cwd so that tmpDir (HOME) and cwd don't overlap.
// This prevents the local .aiignore from being treated as the global ~/.aiignore.
let projectDir: string;

beforeEach(() => {
  projectDir = path.join(tmpDir, "project");
  fs.mkdirSync(projectDir, { recursive: true });
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
      env: { ...process.env, HOME: tmpDir },
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
    fs.writeFileSync(path.join(projectDir, ".aiignore"), ".env\nsecrets/\n");
    fs.writeFileSync(path.join(projectDir, ".env"), "SECRET=abc");

    const result = runHook(".env", projectDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("BLOCKED by .aiignore");
    expect(result.stderr).toContain(".env");
  });

  test("allows file not matching .aiignore", () => {
    fs.writeFileSync(path.join(projectDir, ".aiignore"), ".env\nsecrets/\n");
    fs.writeFileSync(path.join(projectDir, "readme.txt"), "hello");

    const result = runHook("readme.txt", projectDir);
    expect(result.exitCode).toBe(0);
  });

  test("allows everything when no .aiignore exists", () => {
    fs.writeFileSync(path.join(projectDir, ".env"), "SECRET=abc");

    const result = runHook(".env", projectDir);
    expect(result.exitCode).toBe(0);
  });

  // SKIP: Testing global ~/.aiignore blocking would require writing to ~/.aiignore,
  // which is dangerous in automated tests — it could overwrite the user's real
  // global blocklist. This should be verified manually:
  //
  // Manual test steps:
  //   1. Create ~/.aiignore with a pattern like "*.secret"
  //   2. Run: echo '{"tool_input":{"file_path":"test.secret"}}' | bun src/hook/index.ts
  //   3. Verify exit code is 2 and stderr contains "BLOCKED by ~/.aiignore (global)"
  //   4. Clean up ~/.aiignore when done
  test.skip("blocks file matching global ~/.aiignore", () => {
    // Intentionally empty — see comment above
  });
});
