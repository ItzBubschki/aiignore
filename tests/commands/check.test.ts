import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { check } from "../../src/commands/check.js";

let tmpDir: string;
let cwdSpy: ReturnType<typeof spyOn>;
let logOutput: string[];

// Strip ANSI escape codes so assertions work regardless of chalk color support
const stripAnsi = (str: string) => str.replace(/\u001B\[[0-9;]*m/g, "");

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "check-test-"));
  cwdSpy = spyOn(process, "cwd").mockReturnValue(tmpDir);
  logOutput = [];
  spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logOutput.push(args.join(" "));
  });
});

afterEach(() => {
  cwdSpy.mockRestore();
  (console.log as ReturnType<typeof spyOn>).mockRestore();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("check", () => {
  it("prints message when no .aiignore exists", async () => {
    await check();
    const output = stripAnsi(logOutput.join("\n"));
    expect(output).toContain("No .aiignore file found");
  });

  it("prints message when no files are blocked", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.secret\n");
    fs.writeFileSync(path.join(tmpDir, "readme.md"), "hello");

    await check();
    const output = stripAnsi(logOutput.join("\n"));
    expect(output).toContain("No files matched");
  });

  it("lists blocked files", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), ".env\n");
    fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=123");
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "console.log('hi')");

    await check();
    const output = stripAnsi(logOutput.join("\n"));
    expect(output).toContain(".env");
    expect(output).toContain("1 files blocked");
    expect(output).not.toContain("index.ts");
  });

  it("blocks multiple files matching patterns", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.secret\n.env\n");
    fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=123");
    fs.writeFileSync(path.join(tmpDir, "db.secret"), "password");
    fs.writeFileSync(path.join(tmpDir, "app.ts"), "code");

    await check();
    const output = stripAnsi(logOutput.join("\n"));
    expect(output).toContain(".env");
    expect(output).toContain("db.secret");
    expect(output).toContain("2 files blocked");
  });

  it("skips node_modules, .git, and dist directories", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "*.js\n");

    fs.mkdirSync(path.join(tmpDir, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "node_modules", "lib.js"), "x");

    fs.mkdirSync(path.join(tmpDir, ".git"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".git", "hook.js"), "x");

    fs.mkdirSync(path.join(tmpDir, "dist"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "dist", "bundle.js"), "x");

    fs.writeFileSync(path.join(tmpDir, "src.js"), "x");

    await check();
    const output = stripAnsi(logOutput.join("\n"));
    // Only src.js should be counted, not the ones in skipped dirs
    expect(output).toContain("1 files blocked");
    expect(output).toContain("src.js");
  });

  it("handles nested directory structures", async () => {
    fs.writeFileSync(path.join(tmpDir, ".aiignore"), "secrets/\n");

    fs.mkdirSync(path.join(tmpDir, "secrets"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "secrets", "key.pem"), "x");
    fs.writeFileSync(path.join(tmpDir, "secrets", "cert.pem"), "x");
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "app.ts"), "x");

    await check();
    const output = stripAnsi(logOutput.join("\n"));
    expect(output).toContain("2 files blocked");
  });
});
