import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Create an isolated fake home directory before any source modules are imported.
// This prevents tests from reading the real ~/.aiignore or ~/.claude/ directory.
const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "aiignore-test-home-"));
fs.mkdirSync(path.join(fakeHome, ".claude"), { recursive: true });

// Override both the env var (for subprocesses) and the function (for in-process code).
// os.homedir() on macOS may use getpwuid() instead of $HOME, so we must override both.
process.env.HOME = fakeHome;
os.homedir = () => fakeHome;

process.on("exit", () => {
  try {
    fs.rmSync(fakeHome, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});
