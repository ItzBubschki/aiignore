import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// We test the logic by calling the command in a subprocess to isolate cwd changes
const PROJECT_ROOT = path.resolve(import.meta.dir, "../..");

function runAdd(
  cwd: string,
  args: string[],
  flags: string[] = []
): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync(
    ["bun", path.join(PROJECT_ROOT, "src/cli.ts"), "add", ...args, ...flags],
    {
      cwd,
      env: { ...process.env, HOME: cwd },
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

describe("add command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiignore-add-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("adds to local .aiignore when it exists", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "existing\n");
    const result = runAdd(tmpDir, [".env", "secrets/"]);

    expect(result.exitCode).toBe(0);
    const content = fs.readFileSync(path.join(tmpDir, ".aiignore"), "utf-8");
    expect(content).toContain("existing");
    expect(content).toContain(".env");
    expect(content).toContain("secrets/");
  });

  test("adds to global ~/.aiignore when no local file exists", () => {
    const result = runAdd(tmpDir, [".env"]);

    expect(result.exitCode).toBe(0);
    const globalPath = path.join(tmpDir, ".aiignore");
    expect(fs.existsSync(globalPath)).toBe(true);
    const content = fs.readFileSync(globalPath, "utf-8");
    expect(content).toContain(".env");
  });

  test("--local flag forces local .aiignore", () => {
    const result = runAdd(tmpDir, [".env"], ["--local"]);

    expect(result.exitCode).toBe(0);
    const localPath = path.join(tmpDir, ".aiignore");
    expect(fs.existsSync(localPath)).toBe(true);
    const content = fs.readFileSync(localPath, "utf-8");
    expect(content).toContain(".env");
  });

  test("--global flag forces global ~/.aiignore", () => {
    // Create a local .aiignore so default would use it
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "local\n");
    const result = runAdd(tmpDir, ["*.key"], ["--global"]);

    expect(result.exitCode).toBe(0);
    // The global file in this test context is also tmpDir/.aiignore (since HOME=tmpDir)
    // So we verify the content has both the local and global entries
    const content = fs.readFileSync(path.join(tmpDir, ".aiignore"), "utf-8");
    expect(content).toContain("*.key");
  });

  test("skips duplicate patterns", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const result = runAdd(tmpDir, [".env"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("already");
    const content = fs.readFileSync(path.join(tmpDir, ".aiignore"), "utf-8");
    // Should only have one .env line
    const envCount = content.split("\n").filter((l) => l.trim() === ".env").length;
    expect(envCount).toBe(1);
  });

  test("adds multiple patterns at once", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "");
    const result = runAdd(tmpDir, [".env", "*.key", "secrets/", "*.pem"]);

    expect(result.exitCode).toBe(0);
    const content = fs.readFileSync(path.join(tmpDir, ".aiignore"), "utf-8");
    expect(content).toContain(".env");
    expect(content).toContain("*.key");
    expect(content).toContain("secrets/");
    expect(content).toContain("*.pem");
  });

  test("--local and --global together fails", () => {
    const result = runAdd(tmpDir, [".env"], ["--local", "--global"]);
    expect(result.exitCode).not.toBe(0);
  });
});
