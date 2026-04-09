import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadAiignore, isBlocked } from "../../src/lib/aiignore-parser.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiignore-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadAiignore", () => {
  it("returns null when no .aiignore exists", () => {
    expect(loadAiignore(tmpDir)).toBeNull();
  });

  it("returns an Ignore instance when .aiignore exists", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const ig = loadAiignore(tmpDir);
    expect(ig).not.toBeNull();
  });

  it("handles empty .aiignore file", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "");
    const ig = loadAiignore(tmpDir);
    expect(ig).not.toBeNull();
  });
});

describe("isBlocked", () => {
  it("blocks files matching a pattern", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, ".env", tmpDir)).toBe(true);
  });

  it("allows files not matching any pattern", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, "src/index.ts", tmpDir)).toBe(false);
  });

  it("blocks files matching wildcard patterns", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.secret\n");
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, "credentials.secret", tmpDir)).toBe(true);
    expect(isBlocked(ig, "readme.md", tmpDir)).toBe(false);
  });

  it("blocks files matching directory patterns", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "secrets/\n");
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, "secrets/api-key.txt", tmpDir)).toBe(true);
    expect(isBlocked(ig, "src/main.ts", tmpDir)).toBe(false);
  });

  it("handles absolute file paths", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const ig = loadAiignore(tmpDir)!;
    const absolutePath = path.join(tmpDir, ".env");
    expect(isBlocked(ig, absolutePath, tmpDir)).toBe(true);
  });

  it("allows files outside the project directory", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*\n");
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, "/etc/passwd", tmpDir)).toBe(false);
    expect(isBlocked(ig, "../outside.txt", tmpDir)).toBe(false);
  });

  it("ignores comments and blank lines in .aiignore", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".aiignore"),
      "# This is a comment\n\n.env\n# Another comment\n"
    );
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, ".env", tmpDir)).toBe(true);
    expect(isBlocked(ig, "# This is a comment", tmpDir)).toBe(false);
  });

  it("handles negation patterns", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".aiignore"),
      "*.log\n!important.log\n"
    );
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, "debug.log", tmpDir)).toBe(true);
    expect(isBlocked(ig, "important.log", tmpDir)).toBe(false);
  });

  it("blocks nested files matching glob patterns", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "**/*.key\n");
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, "certs/server.key", tmpDir)).toBe(true);
    expect(isBlocked(ig, "deep/nested/path/file.key", tmpDir)).toBe(true);
    expect(isBlocked(ig, "file.txt", tmpDir)).toBe(false);
  });

  it("handles multiple patterns", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".aiignore"),
      ".env\n*.secret\nsecrets/\n"
    );
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, ".env", tmpDir)).toBe(true);
    expect(isBlocked(ig, "db.secret", tmpDir)).toBe(true);
    expect(isBlocked(ig, "secrets/key.txt", tmpDir)).toBe(true);
    expect(isBlocked(ig, "src/app.ts", tmpDir)).toBe(false);
  });
});
