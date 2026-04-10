import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { HOOK_BINARY_NAME } from "../../src/lib/constants.js";

const VERSION_CHECK_SCRIPT = path.resolve(
  import.meta.dir,
  "../../src/hook/version-check.ts"
);

let tmpDir: string;
let fakeHome: string;
let settingsDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "version-check-test-"));
  fakeHome = path.join(tmpDir, "home");
  settingsDir = path.join(fakeHome, ".claude");
  fs.mkdirSync(settingsDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runVersionCheck(env?: Record<string, string>): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const input = JSON.stringify({});

  try {
    const stdout = execSync(`echo '${input}' | bun ${VERSION_CHECK_SCRIPT}`, {
      cwd: tmpDir,
      env: { ...process.env, HOME: fakeHome, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10_000,
    });
    return { exitCode: 0, stdout: stdout.toString(), stderr: "" };
  } catch (err: any) {
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

function writeSettings(version?: string): void {
  const settings: any = {
    hooks: {
      PreToolUse: [
        {
          matcher: "Read|Write|Edit|MultiEdit",
          hooks: [
            {
              type: "command",
              command: `/path/to/${HOOK_BINARY_NAME}`,
            },
          ],
          ...(version ? { version } : {}),
        },
      ],
    },
  };
  fs.writeFileSync(
    path.join(settingsDir, "settings.json"),
    JSON.stringify(settings, null, 2)
  );
}

describe("version-check hook", () => {
  test("exits 0 when no settings exist", () => {
    const result = runVersionCheck();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("exits 0 when no version is stored in settings", () => {
    writeSettings();
    const result = runVersionCheck();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("exits 0 when version is current (mocked via unreachable registry)", () => {
    // With a bogus npm registry URL, the fetch will fail and the hook should fail-open
    writeSettings("99.99.99");
    const result = runVersionCheck({
      npm_config_registry: "http://localhost:1",
    });
    expect(result.exitCode).toBe(0);
  });

  test("exits 0 on network failure (fail-open)", () => {
    writeSettings("0.0.1");
    // Point to an unreachable host to simulate network failure
    const result = runVersionCheck({
      npm_config_registry: "http://localhost:1",
    });
    expect(result.exitCode).toBe(0);
  });
});
