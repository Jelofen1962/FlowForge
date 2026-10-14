export interface RecorderSelection {
  tagName: string;
  id: string;
  name: string;
  text: string;
  xpath: string;
  css: string;
  attributes: {
    role: string;
    type: string;
    ariaLabel: string;
    placeholder: string;
    href: string;
  };
}

export interface RecorderMessage {
  channel: "FLOWFORGE_RECORDER_V1";
  type: "ready" | "selected" | "stopped";
  data?: RecorderSelection | { url: string; title: string } | Record<string, never>;
}

/** Validate cross-window messages before allowing a page to alter the workflow. */
export function parseRecorderMessage(value: unknown): RecorderMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (message.channel !== "FLOWFORGE_RECORDER_V1") return null;
  if (!["ready", "selected", "stopped"].includes(String(message.type))) return null;
  if (message.type === "selected") {
    const data = message.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== "object" ||
        typeof data.tagName !== "string" ||
        typeof data.xpath !== "string" ||
        typeof data.css !== "string" ||
        typeof data.id !== "string" ||
        typeof data.name !== "string" ||
        typeof data.text !== "string") return null;
  }
  return message as unknown as RecorderMessage;
}

export function selectionToLocator(selection: RecorderSelection, preferred: "xpath" | "css" = "css") {
  const value = preferred === "xpath" ? selection.xpath : selection.css;
  return { strategy: preferred, value };
}
