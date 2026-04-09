import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SUPPORTED_SHELLS = ["fish", "bash", "zsh"] as const;
type Shell = (typeof SUPPORTED_SHELLS)[number];

function generateFishCompletions(): string {
  return `# Completions for aiignore CLI
complete -c aiignore -f
complete -c aiignore -n "__fish_use_subcommand" -a install -d "Install the Claude Code hook for .aiignore enforcement"
complete -c aiignore -n "__fish_use_subcommand" -a uninstall -d "Remove the Claude Code hook"
complete -c aiignore -n "__fish_use_subcommand" -a status -d "Show whether the hook is installed and working"
complete -c aiignore -n "__fish_use_subcommand" -a check -d "Dry-run: show which files would be blocked by .aiignore"
`;
}

function generateBashCompletions(): string {
  return `# Completions for aiignore CLI
_aiignore() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  if [ "\$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( \$(compgen -W "install uninstall status check" -- "\$cur") )
  fi
}
complete -F _aiignore aiignore
`;
}

function generateZshCompletions(): string {
  return `#compdef aiignore
_aiignore() {
  local -a commands
  commands=(
    'install:Install the Claude Code hook for .aiignore enforcement'
    'uninstall:Remove the Claude Code hook'
    'status:Show whether the hook is installed and working'
    'check:Dry-run: show which files would be blocked by .aiignore'
  )
  _describe 'command' commands
}
_aiignore
`;
}

const GENERATORS: Record<Shell, () => string> = {
  fish: generateFishCompletions,
  bash: generateBashCompletions,
  zsh: generateZshCompletions,
};

function getInstallPath(shell: Shell): string {
  switch (shell) {
    case "fish":
      return path.join(
        os.homedir(),
        ".config",
        "fish",
        "completions",
        "aiignore.fish"
      );
    case "bash":
      return path.join(
        os.homedir(),
        ".local",
        "share",
        "bash-completion",
        "completions",
        "aiignore"
      );
    case "zsh":
      return path.join(os.homedir(), ".zfunc", "_aiignore");
  }
}

export function detectShell(): Shell | null {
  const shell = process.env.SHELL || "";
  if (shell.includes("fish")) return "fish";
  if (shell.includes("zsh")) return "zsh";
  if (shell.includes("bash")) return "bash";
  return null;
}

export function installCompletions(): { shell: string; path: string } | null {
  const shell = detectShell();
  if (!shell) return null;

  const script = GENERATORS[shell]();
  const installPath = getInstallPath(shell);

  fs.mkdirSync(path.dirname(installPath), { recursive: true });
  fs.writeFileSync(installPath, script);

  return { shell, path: installPath };
}

export function uninstallCompletions(): void {
  for (const shell of SUPPORTED_SHELLS) {
    const p = getInstallPath(shell);
    try {
      fs.unlinkSync(p);
    } catch {
      // File doesn't exist, that's fine
    }
  }
}

export function getCompletionsStatus(): {
  installed: boolean;
  shell: string | null;
  path: string | null;
} {
  const shell = detectShell();
  if (!shell) return { installed: false, shell: null, path: null };

  const p = getInstallPath(shell);
  return { installed: fs.existsSync(p), shell, path: p };
}
