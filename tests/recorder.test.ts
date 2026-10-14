import { describe, expect, it } from "vitest";
import { parseRecorderMessage, selectionToLocator, type RecorderSelection } from "../src/core/recorder";

const selection: RecorderSelection = {
  tagName: "button", id: "submit", name: "submit", text: "Continue",
  xpath: "//*[@id='submit']", css: "#submit",
  attributes: { role: "button", type: "submit", ariaLabel: "", placeholder: "", href: "" }
};

describe("recorder message validation", () => {
  it("accepts valid selected-element messages", () => {
    expect(parseRecorderMessage({ channel: "FLOWFORGE_RECORDER_V1", type: "selected", data: selection })?.type).toBe("selected");
  });
  it("rejects unrelated and malformed messages", () => {
    expect(parseRecorderMessage({ channel: "OTHER", type: "selected", data: selection })).toBeNull();
    expect(parseRecorderMessage({ channel: "FLOWFORGE_RECORDER_V1", type: "selected", data: { xpath: "//button" } })).toBeNull();
    expect(parseRecorderMessage(null)).toBeNull();
  });
  it("maps a selection to XPath or CSS locators", () => {
    expect(selectionToLocator(selection, "xpath")).toEqual({ strategy: "xpath", value: "//*[@id='submit']" });
    expect(selectionToLocator(selection, "css")).toEqual({ strategy: "css", value: "#submit" });
  });
});

