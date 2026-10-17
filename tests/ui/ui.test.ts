import { describe, expect, it } from "vitest";
import { parseLayout, LIMITS, DEFAULT_LAYOUT } from "../../src/ui/state/usePanelLayout";
import { stepTypes, actionIcons, getActionIcon } from "../../src/ui/data/actionCatalog";
import { translate } from "../../src/ui/i18n/translations";
import { makeStep } from "../../src/ui/state/useAppController";

describe("UI Layout & State Logic", () => {
  it("sanitizes invalid or null stored layout gracefully", () => {
    const layout = parseLayout(null);
    expect(layout).toEqual(DEFAULT_LAYOUT);
    expect(layout.steps.size).toBe(DEFAULT_LAYOUT.steps.size);
  });

  it("clamps panel dimensions within safety bounds", () => {
    const oversized = parseLayout(JSON.stringify({ steps: { size: 9999 } }));
    expect(oversized.steps.size).toBe(LIMITS.steps.max);

    const undersized = parseLayout(JSON.stringify({ run: { size: 10 } }));
    expect(undersized.run.size).toBe(LIMITS.run.min);
  });

  it("maps an animated Lucide icon to every step type in the catalog", () => {
    for (const [type] of stepTypes) {
      const icon = getActionIcon(type);
      expect(icon).toBeDefined();
      expect(actionIcons[type]).toBeDefined();
    }
  });

  it("provides Persian translations for common UI actions", () => {
    expect(translate("fa", "Editor")).toBe("ویرایشگر");
    expect(translate("fa", "Workflows")).toBe("گردش‌کارها");
    expect(translate("fa", "Running")).toBe("در حال اجرا");
    expect(translate("en", "Editor")).toBe("Editor");
  });

  it("creates fully-formed typed steps with target defaults", () => {
    const clickStep = makeStep("click");
    expect(clickStep.type).toBe("click");
    expect(clickStep.target.strategy).toBe("css");
    expect(clickStep.id).toBeDefined();

    const ifElseStep = makeStep("ifElse");
    expect(ifElseStep.type).toBe("ifElse");
    expect(ifElseStep.thenSteps).toEqual([]);
    expect(ifElseStep.elseSteps).toEqual([]);
  });
});
