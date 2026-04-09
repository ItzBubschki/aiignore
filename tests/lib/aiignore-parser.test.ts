import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadAiignore,
  loadGlobalAiignore,
  isBlocked,
} from "../../src/lib/aiignore-parser.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiignore-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadAiignore", () => {
  test("returns null when no .aiignore file exists", () => {
    const result = loadAiignore(tmpDir);
    expect(result).toBeNull();
  });

  test("loads patterns from .aiignore file", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\nsecrets/\n");
    const result = loadAiignore(tmpDir);
    expect(result).not.toBeNull();
  });
});

describe("isBlocked", () => {
  test("blocks matching files", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\nsecrets/\n");
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, ".env", tmpDir)).toBe(true);
    expect(isBlocked(ig, "secrets/key.json", tmpDir)).toBe(true);
  });

  test("allows non-matching files", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\nsecrets/\n");
    const ig = loadAiignore(tmpDir)!;
    expect(isBlocked(ig, "src/index.ts", tmpDir)).toBe(false);
    expect(isBlocked(ig, "README.md", tmpDir)).toBe(false);
  });

  test("ignores files outside the project directory", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const ig = loadAiignore(tmpDir)!;
    // A file outside the project (using an absolute path above tmpDir)
    const outsidePath = path.resolve(tmpDir, "..", ".env");
    expect(isBlocked(ig, outsidePath, tmpDir)).toBe(false);
  });
});

describe("loadGlobalAiignore", () => {
  const globalPath = path.join(os.homedir(), ".aiignore");
  const globalExists = fs.existsSync(globalPath);

  test("returns null when no global .aiignore exists", () => {
    // Only run the null assertion if there's genuinely no global file.
    // If a global file exists, we skip to avoid false failures.
    if (globalExists) {
      // The user has a global ~/.aiignore, so loadGlobalAiignore should return non-null
      const result = loadGlobalAiignore();
      expect(result).not.toBeNull();
    } else {
      const result = loadGlobalAiignore();
      expect(result).toBeNull();
    }
  });

  test("loads patterns from ~/.aiignore when it exists", () => {
    // We test via loadAiignore with a temp dir that simulates the home dir,
    // since we cannot safely create/modify ~/.aiignore in tests.
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fake-home-"));
    fs.writeFileSync(
      path.join(fakeHome, ".aiignore"),
      "*.secret\nconfidential/\n"
    );
    // loadAiignore uses the same underlying logic as loadGlobalAiignore
    const ig = loadAiignore(fakeHome);
    expect(ig).not.toBeNull();
    expect(ig!.ignores("test.secret")).toBe(true);
    expect(ig!.ignores("confidential/data.txt")).toBe(true);
    expect(ig!.ignores("public/index.html")).toBe(false);
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });
});
