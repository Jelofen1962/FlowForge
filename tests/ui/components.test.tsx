// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Play } from "lucide-react";
import type { StepType } from "../../src/core/workflow";
import { ActionPicker, Button, Dialog, Field, IconButton, Input, ResizeHandle, Section, Select, SwitchRow } from "../../src/ui/components";

describe("buttons", () => {
  it("IconButton exposes its label as accessible name and tooltip", () => {
    render(<IconButton icon={Play} label="Run it" />);
    const button = screen.getByRole("button", { name: "Run it" });
    expect(button).toHaveAttribute("data-tip", "Run it");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("Button renders an animated Lucide icon and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button icon={Play} iconAnim="nudge" onClick={onClick}>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(button.querySelector("svg")).toHaveClass("ico", "ico-nudge");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("fields", () => {
  it("Field associates its label with the control", () => {
    render(<Field label="Step name"><Input defaultValue="x" /></Field>);
    expect(screen.getByLabelText("Step name")).toHaveValue("x");
  });

  it("Field announces errors", () => {
    render(<Field label="Name" error="Must be unique"><Input /></Field>);
    expect(screen.getByRole("alert")).toHaveTextContent("Must be unique");
  });

  it("SwitchRow is a labelled switch", () => {
    const onChange = vi.fn();
    render(<SwitchRow label="Headless" description="No window" checked={false} onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: /Headless/ });
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("Select forwards value and change events", () => {
    const onChange = vi.fn();
    render(<Select aria-label="Browser" value="chrome" onChange={event => onChange(event.target.value)}><option value="chrome">Chrome</option><option value="edge">Edge</option></Select>);
    fireEvent.change(screen.getByLabelText("Browser"), { target: { value: "edge" } });
    expect(onChange).toHaveBeenCalledWith("edge");
  });
});

describe("Section", () => {
  it("collapses and expands with aria-expanded", () => {
    render(<Section title="Reliability" defaultOpen={false}><p>body</p></Section>);
    const head = screen.getByRole("button", { name: /Reliability/ });
    expect(head).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("body")).not.toBeVisible();
    fireEvent.click(head);
    expect(head).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body")).toBeVisible();
  });
});

describe("Dialog", () => {
  it("moves focus in, traps Tab, closes on Escape and restores focus", () => {
    const onClose = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Dialog open={open} onClose={() => { onClose(); setOpen(false); }} labelledBy="t">
            <h2 id="t">Title</h2>
            <button>first</button>
            <button>last</button>
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByText("open");
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Title" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("first")).toHaveFocus();
    within(dialog).getByText("last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(within(dialog).getByText("first")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe("ResizeHandle", () => {
  const setup = (props: Partial<React.ComponentProps<typeof ResizeHandle>> = {}) => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(<ResizeHandle label="Resize steps" value={300} min={200} max={500} onChange={onChange} onReset={onReset} {...props} />);
    return { onChange, onReset, handle: screen.getByRole("separator", { name: "Resize steps" }) };
  };

  it("exposes separator semantics", () => {
    const { handle } = setup();
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", "300");
    expect(handle).toHaveAttribute("aria-valuemin", "200");
    expect(handle).toHaveAttribute("aria-valuemax", "500");
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("resizes with arrow keys, Shift for bigger steps, and clamps with Home/End", () => {
    const { handle, onChange } = setup();
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(316);
    fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(252);
    fireEvent.keyDown(handle, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(200);
    fireEvent.keyDown(handle, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(500);
  });

  it("inverts arrow direction for end-side panels", () => {
    const { handle, onChange } = setup({ invert: true });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(284);
  });

  it("resets on Enter and double click", () => {
    const { handle, onReset } = setup();
    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.doubleClick(handle);
    expect(onReset).toHaveBeenCalledTimes(2);
  });

  it("horizontal handles grow upward", () => {
    const { handle, onChange } = setup({ orientation: "horizontal" });
    expect(handle).toHaveAttribute("aria-orientation", "horizontal");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(316);
  });
});

describe("ActionPicker", () => {
  const t = (text: string) => text;
  function Harness({ onPick }: { onPick: (type: StepType) => void }) {
    const [value, setValue] = useState<StepType>("click");
    return <ActionPicker t={t} label="Action type" value={value} onChange={type => { setValue(type); onPick(type); }} />;
  }

  it("opens a searchable listbox with icons and selects with the keyboard", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const trigger = screen.getByRole("button", { name: /Action type: Click element/ });
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const search = screen.getByRole("combobox");
    expect(screen.getByRole("listbox").querySelectorAll("svg").length).toBeGreaterThan(10);
    fireEvent.change(search, { target: { value: "screenshot" } });
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(1);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith("screenshot");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape without changing the value and shows an empty state for no matches", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Action type/ }));
    const search = screen.getByRole("combobox");
    fireEvent.change(search, { target: { value: "zzzz-nothing" } });
    expect(screen.getByText("No matching actions.")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("moves the active option with arrow keys", () => {
    render(<Harness onPick={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Action type/ }));
    const search = screen.getByRole("combobox");
    const before = search.getAttribute("aria-activedescendant");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(search.getAttribute("aria-activedescendant")).not.toBe(before);
  });
});
