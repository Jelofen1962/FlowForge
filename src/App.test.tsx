import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

vi.mock("./backend", () => ({
  backend: {
    available: vi.fn().mockResolvedValue(false),
    listBrowsers: vi.fn().mockResolvedValue([]),
    launchBrowser: vi.fn().mockResolvedValue({}),
    runWorkflow: vi.fn().mockResolvedValue({})
  }
}));

describe("CobWeb workspace", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the starter workflow and selected step", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Product price monitor" })).toBeInTheDocument();
    expect(screen.getByText("Open product page")).toBeInTheDocument();
    expect(screen.getByLabelText("Target URL")).toHaveValue("https://example.com/products");
  });

  it("adds a step from the library and lets the user edit its title", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Type text/ }));
    const title = screen.getByLabelText("Step name");
    fireEvent.change(title, { target: { value: "Enter search term" } });
    expect(screen.getByText("Enter search term")).toBeInTheDocument();
    expect(screen.getByLabelText("Step name")).toHaveValue("Enter search term");
  });

  it("can disable and re-enable the selected step", () => {
    render(<App />);
    const toggle = screen.getByRole("switch", { name: "Enable step" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(screen.getByRole("switch", { name: "Enable step" })).toHaveAttribute("aria-checked", "false");
  });

  it("filters step library items", () => {
    render(<App />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search steps" }), { target: { value: "extract" } });
    // Scope this assertion to the library. The workflow canvas also has an
    // "Extract data" step, so a page-wide button query is ambiguous.
    expect(screen.getByText("Extract data", { selector: ".palette-copy strong" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Navigate/ })).not.toBeInTheDocument();
  });

  it("shows a useful desktop-only message when running outside Tauri", async () => {
    const { backend } = await import("./backend");
    vi.mocked(backend.runWorkflow).mockRejectedValueOnce(new Error("Launch a CobWeb desktop build to control a local browser."));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Run workflow/ }));
    await waitFor(async () => {
      const messages = await screen.findAllByText(/desktop build to control a local browser/);
      expect(messages.length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("copies workflow JSON through the export action", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Export JSON/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"Product price monitor"'));
  });
});
