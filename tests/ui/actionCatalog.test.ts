import { describe, expect, it } from "vitest";
import { actionGroups, actionIcons, getActionIcon, getActionLabel, stepTypes } from "../../src/ui/data/actionCatalog";

describe("action catalog", () => {
  it("gives every action a Lucide icon (no emoji)", () => {
    for (const [type] of stepTypes) {
      expect(getActionIcon(type), `icon for ${type}`).toBeTruthy();
      expect(actionIcons[type]).toBeTruthy();
    }
  });

  it("lists every action in exactly one group", () => {
    const seen = new Map<string, number>();
    for (const group of actionGroups) for (const type of group.types) seen.set(type, (seen.get(type) ?? 0) + 1);
    for (const [type] of stepTypes) expect(seen.get(type), `group count for ${type}`).toBe(1);
    expect(seen.size).toBe(stepTypes.length);
  });

  it("uses unique, emoji-free labels", () => {
    const labels = stepTypes.map(([, label]) => label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(getActionLabel("click")).toBe(stepTypes.find(([type]) => type === "click")![1]);
  });
});
