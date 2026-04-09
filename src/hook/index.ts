import fs from "node:fs";
import path from "node:path";
import ignore from "ignore";

const AIIGNORE_FILENAME = ".aiignore";

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

  // Load .aiignore
  const aiignorePath = path.join(cwd, AIIGNORE_FILENAME);
  let content: string;
  try {
    content = fs.readFileSync(aiignorePath, "utf-8");
  } catch {
    // No .aiignore → allow everything
    process.exit(0);
  }

  const ig = ignore().add(content);

  // Check if file is blocked
  const relative = path.relative(cwd, absolute);

  // Files outside the project directory are not subject to .aiignore
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    process.exit(0);
  }

  if (ig.ignores(relative)) {
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
