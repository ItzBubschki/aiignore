import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseAuditLog } from "../../src/commands/audit.js";

const PROJECT_ROOT = path.resolve(import.meta.dir, "../..");

function runAudit(
  args: string[] = []
): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync(
    ["bun", path.join(PROJECT_ROOT, "src/cli.ts"), "audit", ...args],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    }
  );
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

describe("parseAuditLog", () => {
  test("returns empty array for empty content", () => {
    expect(parseAuditLog("")).toEqual([]);
    expect(parseAuditLog("   ")).toEqual([]);
    expect(parseAuditLog("\n\n")).toEqual([]);
  });

  test("parses valid log lines correctly", () => {
    const content = `[2026-04-09T14:30:00.000Z] BLOCKED local /Users/x/project .env\n`;
    const entries = parseAuditLog(content);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      timestamp: "2026-04-09T14:30:00.000Z",
      source: "local",
      cwd: "/Users/x/project",
      file: ".env",
    });
  });

  test("parses multiple entries", () => {
    const content = [
      "[2026-04-09T14:30:00.000Z] BLOCKED local /Users/x/project .env",
      "[2026-04-09T14:30:01.000Z] BLOCKED global /Users/x/project secrets/key.pem",
      "[2026-04-09T14:31:15.000Z] BLOCKED local /Users/x/other-project credentials.json",
    ].join("\n");

    const entries = parseAuditLog(content);
    expect(entries).toHaveLength(3);
    expect(entries[0].source).toBe("local");
    expect(entries[0].file).toBe(".env");
    expect(entries[1].source).toBe("global");
    expect(entries[1].file).toBe("secrets/key.pem");
    expect(entries[2].cwd).toBe("/Users/x/other-project");
    expect(entries[2].file).toBe("credentials.json");
  });

  test("handles malformed lines gracefully by skipping them", () => {
    const content = [
      "[2026-04-09T14:30:00.000Z] BLOCKED local /Users/x/project .env",
      "this is not a valid line",
      "",
      "BLOCKED missing-brackets local /foo bar",
      "[2026-04-09T14:30:01.000Z] BLOCKED global /Users/x/project secrets/key.pem",
    ].join("\n");

    const entries = parseAuditLog(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].file).toBe(".env");
    expect(entries[1].file).toBe("secrets/key.pem");
  });

  test("parses mixed global/local entries", () => {
    const content = [
      "[2026-04-09T10:00:00.000Z] BLOCKED global /Users/a/proj secret.key",
      "[2026-04-09T10:01:00.000Z] BLOCKED local /Users/b/proj .env",
      "[2026-04-09T10:02:00.000Z] BLOCKED global /Users/c/proj id_rsa",
      "[2026-04-09T10:03:00.000Z] BLOCKED local /Users/d/proj config/db.yml",
    ].join("\n");

    const entries = parseAuditLog(content);
    expect(entries).toHaveLength(4);
    expect(entries.filter((e) => e.source === "global")).toHaveLength(2);
    expect(entries.filter((e) => e.source === "local")).toHaveLength(2);
  });

  test("handles file paths with spaces", () => {
    const content = `[2026-04-09T14:30:00.000Z] BLOCKED local /Users/x/project my secret file.env\n`;
    const entries = parseAuditLog(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].file).toBe("my secret file.env");
  });
});

describe("audit command (subprocess)", () => {
  test("shows no-entries message when log doesn't exist", () => {
    // Use a fake HOME to avoid reading the real audit log
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "aiignore-audit-test-"));
    fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });

    const result = Bun.spawnSync(
      ["bun", path.join(PROJECT_ROOT, "src/cli.ts"), "audit"],
      {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, HOME: tmpHome },
      }
    );

    const stdout = result.stdout.toString();
    expect(stdout).toContain("No blocked access attempts logged.");

    fs.rmSync(tmpHome, { recursive: true, force: true });
  });
});
