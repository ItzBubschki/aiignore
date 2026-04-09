import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import ignore from "ignore";

const AIIGNORE_FILENAME = ".aiignore";
const GLOBAL_AIIGNORE_PATH = path.join(os.homedir(), AIIGNORE_FILENAME);
const AUDIT_LOG_PATH = path.join(os.homedir(), ".claude", "aiignore-audit.log");

function logBlocked(source: "global" | "local", cwd: string, filePath: string): void {
  try {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] BLOCKED ${source} ${cwd} ${filePath}\n`;
    fs.appendFileSync(AUDIT_LOG_PATH, line);
  } catch {
    // Fire-and-forget: never break the hook
  }
}

async function main(): Promise<void> {
  // Read JSON from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const input = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

  // Extract file path from tool input
  const toolInput = input.tool_input ?? {};
  const filePath: string | undefined =
    toolInput.file_path ?? toolInput.path ?? undefined;

  if (!filePath) {
    process.exit(0);
  }

  // Resolve to absolute path
  const cwd = process.cwd();
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(cwd, filePath);

  // Check global ~/.aiignore first
  try {
    const globalContent = fs.readFileSync(GLOBAL_AIIGNORE_PATH, "utf-8");
    const globalIg = ignore().add(globalContent);
    // For global blocklist, compute relative path from home dir
    const relativeToHome = path.relative(os.homedir(), absolute);
    if (
      relativeToHome &&
      !relativeToHome.startsWith("..") &&
      !path.isAbsolute(relativeToHome) &&
      globalIg.ignores(relativeToHome)
    ) {
      logBlocked("global", cwd, filePath);
      process.stderr.write(
        `BLOCKED by ~/.aiignore (global): Access to '${filePath}' is denied.\n` +
          `This file matches a pattern in ~/.aiignore. Remove the pattern to allow access.\n`
      );
      process.exit(2);
    }
    // Also check with relative path from cwd for patterns that are project-relative
    const relativeToCwd = path.relative(cwd, absolute);
    if (
      relativeToCwd &&
      !relativeToCwd.startsWith("..") &&
      !path.isAbsolute(relativeToCwd) &&
      globalIg.ignores(relativeToCwd)
    ) {
      logBlocked("global", cwd, filePath);
      process.stderr.write(
        `BLOCKED by ~/.aiignore (global): Access to '${filePath}' is denied.\n` +
          `This file matches a pattern in ~/.aiignore. Remove the pattern to allow access.\n`
      );
      process.exit(2);
    }
  } catch {
    // No global .aiignore — continue
  }

  // Load local .aiignore
  const aiignorePath = path.join(cwd, AIIGNORE_FILENAME);
  let content: string;
  try {
    content = fs.readFileSync(aiignorePath, "utf-8");
  } catch {
    // No local .aiignore → allow everything
    process.exit(0);
  }

  const ig = ignore().add(content);

  // Check if file is blocked
  const relative = path.relative(cwd, absolute);

  // Files outside the project directory are not subject to local .aiignore
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    process.exit(0);
  }

  if (ig.ignores(relative)) {
    logBlocked("local", cwd, filePath);
    process.stderr.write(
      `BLOCKED by .aiignore: Access to '${filePath}' is denied.\n` +
        `This file matches a pattern in ${AIIGNORE_FILENAME}. Remove the pattern to allow access.\n`
    );
    process.exit(2);
  }

  process.exit(0);
}

main().catch(() => {
  // Fail-open: if anything goes wrong, allow the operation
  process.exit(0);
});
