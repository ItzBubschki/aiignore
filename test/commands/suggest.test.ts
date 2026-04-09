import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  detectSensitiveFiles,
  filterAlreadyBlocked,
} from "../../src/commands/suggest.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "suggest-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Helper to create a file (and its parent directories) inside the temp dir. */
function touch(relativePath: string, content = ""): void {
  const fullPath = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

describe("detectSensitiveFiles", () => {
  test("detects .env file", () => {
    touch(".env", "SECRET=abc");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain(".env");
  });

  test("detects .env.production but not .env.example", () => {
    touch(".env.production", "SECRET=abc");
    touch(".env.example", "SECRET=placeholder");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain(".env.production");
    expect(result).not.toContain(".env.example");
  });

  test("detects *.pem and *.key files", () => {
    touch("certs/server.pem", "-----BEGIN CERTIFICATE-----");
    touch("secrets/api.key", "key-data");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain(path.join("certs", "server.pem"));
    expect(result).toContain(path.join("secrets", "api.key"));
  });

  test("does NOT suggest .env.example", () => {
    touch(".env.example", "# example env");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toEqual([]);
  });

  test("returns empty when no sensitive files exist", () => {
    touch("README.md", "# Hello");
    touch("src/index.ts", "console.log('hi')");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toEqual([]);
  });

  test("skips node_modules directory", () => {
    touch("node_modules/.env", "SECRET=abc");
    touch("node_modules/package/credentials.json", "{}");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toEqual([]);
  });

  test("detects credentials.json", () => {
    touch("credentials.json", "{}");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain("credentials.json");
  });

  test("detects SSH key files", () => {
    touch(".ssh/id_rsa", "key");
    touch(".ssh/id_ed25519", "key");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain(path.join(".ssh", "id_rsa"));
    expect(result).toContain(path.join(".ssh", "id_ed25519"));
  });

  test("detects service-account JSON files", () => {
    touch("service-account-prod.json", "{}");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain("service-account-prod.json");
  });

  test("detects .npmrc and .pypirc", () => {
    touch(".npmrc", "//registry.npmjs.org/:_authToken=secret");
    touch(".pypirc", "[pypi]\npassword=secret");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain(".npmrc");
    expect(result).toContain(".pypirc");
  });

  test("detects docker-compose.override.yml", () => {
    touch("docker-compose.override.yml", "version: '3'");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain("docker-compose.override.yml");
  });

  test("detects .htpasswd and wp-config.php", () => {
    touch(".htpasswd", "user:hash");
    touch("wp-config.php", "<?php");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain(".htpasswd");
    expect(result).toContain("wp-config.php");
  });

  test("detects .keystore files", () => {
    touch("release.keystore", "binary");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain("release.keystore");
  });

  test("detects .secret and .secrets files", () => {
    touch("app.secret", "data");
    touch("api.secrets", "data");
    const result = detectSensitiveFiles(tmpDir);
    expect(result).toContain("app.secret");
    expect(result).toContain("api.secrets");
  });
});

describe("filterAlreadyBlocked", () => {
  test("filters out files already in .aiignore", () => {
    touch(".env", "SECRET=abc");
    touch(".env.production", "SECRET=abc");
    touch("credentials.json", "{}");
    // Create a .aiignore that covers .env and credentials.json
    touch(".aiignore", ".env\ncredentials.json\n");

    const detected = detectSensitiveFiles(tmpDir);
    const unblocked = filterAlreadyBlocked(detected, tmpDir);

    expect(unblocked).not.toContain(".env");
    expect(unblocked).not.toContain("credentials.json");
    expect(unblocked).toContain(".env.production");
  });

  test("returns all files when no .aiignore exists", () => {
    touch(".env", "SECRET=abc");
    touch("credentials.json", "{}");

    const detected = detectSensitiveFiles(tmpDir);
    const unblocked = filterAlreadyBlocked(detected, tmpDir);

    expect(unblocked).toEqual(detected);
  });

  test("returns empty when all sensitive files are already blocked", () => {
    touch(".env", "SECRET=abc");
    touch("credentials.json", "{}");
    touch(".aiignore", ".env\ncredentials.json\n");

    const detected = detectSensitiveFiles(tmpDir);
    const unblocked = filterAlreadyBlocked(detected, tmpDir);

    expect(unblocked).toEqual([]);
  });
});
