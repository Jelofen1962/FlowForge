import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { faTranslations, translate } from "../../src/ui/i18n/translations";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });

describe("Persian translations", () => {
  it("falls back to English for unknown strings and for the English language", () => {
    expect(translate("en", "Run workflow")).toBe("Run workflow");
    expect(translate("fa", "a string that does not exist")).toBe("a string that does not exist");
    expect(translate("fa", "Run workflow")).not.toBe("Run workflow");
  });

  it("has no empty values", () => {
    const empty = Object.entries(faTranslations).filter(([, value]) => !value.trim());
    expect(empty).toEqual([]);
  });

  it("covers every literal passed to t(\"…\") in the UI source", () => {
    const missing = new Set<string>();
    for (const file of walk(join(process.cwd(), "src/ui")).filter(f => !f.includes("i18n"))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
        const text = match[1].replace(/\\"/g, '"');
        if (/[A-Za-z]/.test(text) && !(text in faTranslations)) missing.add(text);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });
});
