import { useEffect, useRef, useState } from "react";
import { Check, Copy, Eraser } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Button, cx } from "../components";

const level = (line: string) => (/\b(error|failed|fail|rejected|cannot|could not|exited \([1-9])/i.test(line) ? "is-error" : /\b(warn|retry|retrying|skipped)/i.test(line) ? "is-warn" : /\b(success|saved|created|imported|exported|started)\b/i.test(line) ? "is-ok" : "");

/** Log lines with severity colouring. Auto-scrolls to the newest line while you are at the bottom. */
export function LogView({ lines, empty, className }: { lines: string[]; empty: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const node = ref.current;
    if (node && stick.current) node.scrollTop = node.scrollHeight;
  }, [lines]);
  return (
    <div
      ref={ref}
      className={cx("console", className)}
      style={{ height: "100%", overflow: "auto" }}
      role="log"
      aria-live="off"
      onScroll={event => {
        const n = event.currentTarget;
        stick.current = n.scrollHeight - n.scrollTop - n.clientHeight < 24;
      }}
      tabIndex={0}
      aria-label="Engine output"
    >
      {lines.length === 0 && <div className="console-empty">{empty}</div>}
      {lines.map((line, index) => (
        <div key={index} className={cx("log-line", level(line))}>
          <span className="log-no">{String(index + 1).padStart(lines.length > 99 ? 3 : 2, "0")}</span>
          <code>{line}</code>
        </div>
      ))}
    </div>
  );
}

export function ConsoleActions({ app }: { app: AppController }) {
  const { t, logs } = app;
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" icon={copied ? Check : Copy} iconAnim="pop" disabled={!logs.length} onClick={() => {
        void navigator.clipboard?.writeText(logs.join("\n"));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}>{copied ? t("Copied") : t("Copy")}</Button>
      <Button size="sm" variant="ghost" icon={Eraser} iconAnim="wiggle" disabled={!logs.length} onClick={() => app.setLogs([])}>{t("Clear")}</Button>
    </>
  );
}
