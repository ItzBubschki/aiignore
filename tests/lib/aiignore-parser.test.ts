import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadAiignore,
  loadAiignoreChain,
  loadGlobalAiignore,
  isBlocked,
  isBlockedByChain,
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

describe("loadAiignoreChain", () => {
  test("returns empty array when no .aiignore files exist", () => {
    const chain = loadAiignoreChain(tmpDir);
    // Filter to only entries within tmpDir to avoid picking up real .aiignore files
    const relevant = chain.filter((e) => e.basePath.startsWith(tmpDir));
    expect(relevant).toEqual([]);
  });

  test("finds .aiignore in current directory", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const chain = loadAiignoreChain(tmpDir);
    const relevant = chain.filter((e) => e.basePath.startsWith(tmpDir));
    expect(relevant).toHaveLength(1);
    expect(relevant[0].basePath).toBe(tmpDir);
  });

  test("finds .aiignore files in parent directories", () => {
    const child = path.join(tmpDir, "projects", "myapp");
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.secret\n");
    fs.writeFileSync(path.join(child, ".aiignore"), ".env\n");

    const chain = loadAiignoreChain(child);
    const relevant = chain.filter((e) => e.basePath.startsWith(tmpDir));
    expect(relevant).toHaveLength(2);
    // First entry should be closest (child), last should be farthest (tmpDir)
    expect(relevant[0].basePath).toBe(child);
    expect(relevant[1].basePath).toBe(tmpDir);
  });

  test("skips directories without .aiignore", () => {
    const grandchild = path.join(tmpDir, "a", "b");
    fs.mkdirSync(grandchild, { recursive: true });
    // Only put .aiignore at root and grandchild, not in "a"
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.secret\n");
    fs.writeFileSync(path.join(grandchild, ".aiignore"), ".env\n");

    const chain = loadAiignoreChain(grandchild);
    const relevant = chain.filter((e) => e.basePath.startsWith(tmpDir));
    expect(relevant).toHaveLength(2);
    expect(relevant[0].basePath).toBe(grandchild);
    expect(relevant[1].basePath).toBe(tmpDir);
  });
});

describe("isBlockedByChain", () => {
  test("blocks file matching .aiignore in current directory", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const chain = loadAiignoreChain(tmpDir);
    const result = isBlockedByChain(chain, ".env", tmpDir);
    expect(result).toBe(tmpDir);
  });

  test("blocks file matching .aiignore in parent directory", () => {
    const child = path.join(tmpDir, "myapp");
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.secret\n");

    const chain = loadAiignoreChain(child);
    // "data.secret" in child/ should be blocked by parent's *.secret
    const result = isBlockedByChain(chain, "data.secret", child);
    expect(result).toBe(tmpDir);
  });

  test("closer .aiignore takes precedence (returns first match)", () => {
    const child = path.join(tmpDir, "myapp");
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    fs.writeFileSync(path.join(child, ".aiignore"), ".env\n");

    const chain = loadAiignoreChain(child);
    const result = isBlockedByChain(chain, ".env", child);
    // Should match the closer one first
    expect(result).toBe(child);
  });

  test("returns null for non-matching files", () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    const chain = loadAiignoreChain(tmpDir);
    const result = isBlockedByChain(chain, "README.md", tmpDir);
    expect(result).toBeNull();
  });

  test("parent pattern uses correct relative path", () => {
    const child = path.join(tmpDir, "packages", "api");
    fs.mkdirSync(child, { recursive: true });
    // Parent blocks "packages/api/secrets/" — but the pattern is just "secrets/"
    // which should match any "secrets/" relative to the parent's basePath
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "secrets/\n");

    const chain = loadAiignoreChain(child);
    // File at packages/api/secrets/key.pem — relative to tmpDir this is
    // packages/api/secrets/key.pem, which should NOT match "secrets/"
    // because ignore matches "secrets/" only at the root level
    const result = isBlockedByChain(
      chain,
      "secrets/key.pem",
      child
    );
    // Relative to tmpDir: "packages/api/secrets/key.pem" — does "secrets/" match this?
    // With the `ignore` package, "secrets/" matches "secrets/..." at any depth
    // So this SHOULD be blocked
    expect(result).toBe(tmpDir);
  });

  test("file outside all .aiignore trees is not blocked", () => {
    const child = path.join(tmpDir, "myapp");
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(path.join(child, ".aiignore"), ".env\n");

    const chain = loadAiignoreChain(child);
    // A file above the child dir: relative to child it's "../.env"
    const outsidePath = path.resolve(child, "..", "outside.txt");
    const result = isBlockedByChain(chain, outsidePath, child);
    // The child's .aiignore won't match it (outside its tree)
    // But there's no .aiignore in tmpDir, so nothing blocks it
    expect(result).toBeNull();
  });
});

describe("loadGlobalAiignore", () => {
  test("returns null when no global .aiignore exists", () => {
    const result = loadGlobalAiignore();
    expect(result).toBeNull();
  });

  test("loads patterns from ~/.aiignore when it exists", () => {
    const globalPath = path.join(os.homedir(), ".aiignore");
    fs.writeFileSync(globalPath, "*.secret\nconfidential/\n");

    const ig = loadGlobalAiignore();
    expect(ig).not.toBeNull();
    expect(ig!.ignores("test.secret")).toBe(true);
    expect(ig!.ignores("confidential/data.txt")).toBe(true);
    expect(ig!.ignores("public/index.html")).toBe(false);

    fs.unlinkSync(globalPath);
  });
});
