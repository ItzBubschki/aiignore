import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let tmpDir: string;
const hookPath = path.resolve(
  import.meta.dir,
  "../../src/hook/index.ts"
);

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "hook-test-"))
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function runHook(
  input: object,
  cwd: string
): Promise<{ exitCode: number; stderr: string }> {
  const proc = Bun.spawn(["bun", hookPath], {
    cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  proc.stdin.write(JSON.stringify(input));
  proc.stdin.end();

  const exitCode = await proc.exited;
  const stderr = await new Response(proc.stderr).text();

  return { exitCode, stderr };
}

describe("hook", () => {
  it("exits 0 when no .aiignore exists", async () => {
    const { exitCode } = await runHook(
      { tool_input: { file_path: "src/index.ts" } },
      tmpDir
    );
    expect(exitCode).toBe(0);
  });

  it("exits 0 when file is not blocked", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const { exitCode } = await runHook(
      { tool_input: { file_path: "src/index.ts" } },
      tmpDir
    );
    expect(exitCode).toBe(0);
  });

  it("exits 2 when file is blocked", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const { exitCode, stderr } = await runHook(
      { tool_input: { file_path: ".env" } },
      tmpDir
    );
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED by .aiignore");
  });

  it("exits 0 when no file_path in tool_input", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const { exitCode } = await runHook({ tool_input: {} }, tmpDir);
    expect(exitCode).toBe(0);
  });

  it("exits 0 for files outside the project directory", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*\n");
    const { exitCode } = await runHook(
      { tool_input: { file_path: "/etc/passwd" } },
      tmpDir
    );
    expect(exitCode).toBe(0);
  });

  it("blocks files matching wildcard patterns", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.secret\n");
    const { exitCode } = await runHook(
      { tool_input: { file_path: "credentials.secret" } },
      tmpDir
    );
    expect(exitCode).toBe(2);
  });

  it("reads path from tool_input.path as fallback", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const { exitCode } = await runHook(
      { tool_input: { path: ".env" } },
      tmpDir
    );
    expect(exitCode).toBe(2);
  });

  it("handles absolute file paths within project", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const { exitCode } = await runHook(
      { tool_input: { file_path: path.join(tmpDir, ".env") } },
      tmpDir
    );
    expect(exitCode).toBe(2);
  });

  it("includes helpful message in stderr when blocked", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "secrets/\n");
    const { stderr } = await runHook(
      { tool_input: { file_path: "secrets/api-key.txt" } },
      tmpDir
    );
    expect(stderr).toContain("BLOCKED by .aiignore");
    expect(stderr).toContain("secrets/api-key.txt");
    expect(stderr).toContain(".aiignore");
  });
});
