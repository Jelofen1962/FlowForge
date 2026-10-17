/**
 * FlowForge passive browser recorder.
 * Records normal user interactions without preventing the page from behaving normally.
 * Password and likely payment fields are deliberately excluded.
 */
"use strict";
(() => {
  const CHANNEL = "FLOWFORGE_RECORDER_V1";
  const STATE_KEY = "__flowforgeRecorderStateV1";
  if (window[STATE_KEY]?.stop) window[STATE_KEY].stop();
  let active = true;
  const timers = new WeakMap();
  const lastValues = new WeakMap();
  const pendingInputs = new Set();
  const events = window.__flowforgeRecorderEventsV1 || (window.__flowforgeRecorderEventsV1 = []);
  const own = el => !!(el && el.nodeType === 1 && (el.id || "").startsWith("__flowforge_recorder_"));
  const isSensitive = el => {
    const type = String(el?.type || "").toLowerCase();
    const hint = [el?.name, el?.id, el?.autocomplete, el?.getAttribute?.("aria-label"), el?.placeholder].filter(Boolean).join(" ").toLowerCase();
    return type === "password" || /password|passwd|credit.?card|card.?number|cvc|cvv|security.?code|one.?time.?code|otp|secret|token/.test(hint);
  };
  const cssEscape = value => window.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  function cssSelector(el) {
    if (!(el instanceof Element)) return "";
    if (el.id && document.querySelectorAll(`#${cssEscape(el.id)}`).length === 1) return `#${cssEscape(el.id)}`;
    const quote = value => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    for (const [attribute, value] of [["data-testid", el.getAttribute("data-testid")], ["data-test", el.getAttribute("data-test")], ["name", el.getAttribute("name")], ["aria-label", el.getAttribute("aria-label")], ["placeholder", el.getAttribute("placeholder")]]) {
      if (value && document.querySelectorAll(`${el.tagName.toLowerCase()}[${attribute}="${quote(value)}"]`).length === 1) return `${el.tagName.toLowerCase()}[${attribute}="${quote(value)}"]`;
    }
    const parts = []; let node = el;
    while (node && node instanceof Element && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      const stable = Array.from(node.classList || []).filter(c => /^[A-Za-z_-][\w-]*$/.test(c) && !/^(active|selected|hover|focus|css-|ng-)/i.test(c)).slice(0, 2);
      if (stable.length) part += stable.map(c => `.${cssEscape(c)}`).join("");
      if (node.parentElement) { const peers = Array.from(node.parentElement.children).filter(x => x.tagName === node.tagName); if (peers.length > 1) part += `:nth-of-type(${peers.indexOf(node) + 1})`; }
      parts.unshift(part); node = node.parentElement;
    }
    return parts.join(" > ");
  }
  function xpath(el) {
    if (!(el instanceof Element)) return "";
    if (el.id) return `//*[@id='${String(el.id).replace(/'/g, "&apos;")}']`;
    const parts = []; let node = el;
    while (node && node instanceof Element && node !== document.documentElement) {
      const siblings = node.parentElement ? Array.from(node.parentElement.children).filter(x => x.tagName === node.tagName) : [];
      parts.unshift(node.tagName.toLowerCase() + (siblings.length > 1 ? `[${siblings.indexOf(node) + 1}]` : "")); node = node.parentElement;
    }
    return `/${document.documentElement.tagName.toLowerCase()}/${parts.join("/")}`;
  }
  function target(el) {
    if (!(el instanceof Element)) return null;
    const control = el.closest("input,textarea,select,button,a,[role=button],[role=link],[contenteditable=true],form") || el;
    if (own(control) || isSensitive(control)) return null;
    return { strategy: "css", value: cssSelector(control), xpath: xpath(control), tagName: control.tagName.toLowerCase(), id: control.id || "", name: control.getAttribute("name") || "",
      text: String(control.innerText || control.getAttribute("aria-label") || control.getAttribute("placeholder") || control.title || "").replace(/\s+/g, " ").trim().slice(0, 120),
      attributes: { type: control.getAttribute("type") || "", role: control.getAttribute("role") || "", placeholder: control.getAttribute("placeholder") || "", ariaLabel: control.getAttribute("aria-label") || "", href: control instanceof HTMLAnchorElement ? control.href : "" } };
  }
  function push(action, el, extra = {}) {
    const loc = el ? target(el) : null;
    events.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, action, url: location.href, title: document.title, target: loc, at: Date.now(), ...extra });
    if (events.length > 500) events.splice(0, events.length - 500);
  }
  function flushInput(el) {
    const timer = timers.get(el); if (timer) clearTimeout(timer);
    timers.delete(el); pendingInputs.delete(el);
    if (!active || !(el instanceof Element) || isSensitive(el)) return;
    const value = el.isContentEditable ? el.innerText : el.value;
    if (typeof value !== "string" || lastValues.get(el) === value) return;
    lastValues.set(el, value);
    const type = String(el.type || "").toLowerCase();
    push("type", el, { text: value, inputType: type || (el.tagName.toLowerCase() === "textarea" ? "textarea" : "text") });
  }
  function inputValue(el) {
    if (!(el instanceof Element) || isSensitive(el)) return;
    const type = String(el.type || "").toLowerCase();
    if (type === "checkbox" || type === "radio") { push("check", el, { checked: !!el.checked, inputType: type }); return; }
    const value = el.isContentEditable ? el.innerText : el.value;
    if (typeof value !== "string" || lastValues.get(el) === value) return;
    const old = timers.get(el); if (old) clearTimeout(old);
    pendingInputs.add(el);
    timers.set(el, setTimeout(() => flushInput(el), 450));
  }
  function onClick(e) {
    if (!active) return;
    const el = e.composedPath().find(x => x instanceof Element && x.matches("button,a,input[type=button],input[type=submit],input[type=checkbox],input[type=radio],[role=button],[role=link]"));
    if (!el || own(el) || isSensitive(el) || (el instanceof HTMLInputElement && ["checkbox","radio"].includes(el.type))) return;
    push("click", el, { button: e.button === 2 ? "right" : "left", href: el instanceof HTMLAnchorElement ? el.href : "" });
  }
  function onInput(e) { if (active && e.target instanceof Element) inputValue(e.target); }
  function onChange(e) {
    const el = e.target; if (!active || !(el instanceof Element) || isSensitive(el)) return;
    if (el instanceof HTMLSelectElement) push("select", el, { value: el.value, selectedText: el.selectedOptions[0]?.textContent || "" });
    else if (!(el instanceof HTMLInputElement && ["checkbox","radio"].includes(el.type))) inputValue(el);
  }
  function onKey(e) {
    if (!active || (e.target instanceof Element && isSensitive(e.target))) return;
    const key = e.key;
    if (["Enter","Tab","Escape","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End","PageUp","PageDown","Backspace","Delete"].includes(key) || ((e.ctrlKey || e.metaKey || e.altKey) && key.length === 1)) {
      const aliases = { ArrowUp: "ARROW_UP", ArrowDown: "ARROW_DOWN", ArrowLeft: "ARROW_LEFT", ArrowRight: "ARROW_RIGHT", PageUp: "PAGEUP", PageDown: "PAGEDOWN", Backspace: "BACKSPACE", Escape: "ESCAPE", Delete: "DELETE" };
      const parts = []; if (e.ctrlKey) parts.push("CTRL"); if (e.metaKey) parts.push("META"); if (e.altKey) parts.push("ALT"); if (e.shiftKey && key.length === 1) parts.push("SHIFT");
      parts.push(({ Enter: "ENTER", Tab: "TAB", Space: "SPACE", ...aliases })[key] || (key.length === 1 ? key.toUpperCase() : key.toUpperCase()));
      push("key", e.target instanceof Element ? e.target : null, { key: parts.join("+"), modifiers: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey } });
    }
  }
  function onContextMenu(e) { if (active && e.target instanceof Element && !isSensitive(e.target)) push("rightClick", e.target); }
  function onDoubleClick(e) { if (active && e.target instanceof Element && !isSensitive(e.target)) push("doubleClick", e.target); }
  let hoverTimer, hoverTarget = null, dragSource = null;
  function onMouseOver(e) {
    if (!active) return;
    const el = e.target instanceof Element ? (e.target.closest("button,a,input,textarea,select,[role=button],[role=link]") || null) : null;
    if (!el || el === hoverTarget || own(el) || isSensitive(el)) return;
    hoverTarget = el; clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => { if (active && hoverTarget === el) push("hover", el); }, 800);
  }
  function onDragStart(e) { if (active && e.target instanceof Element && !isSensitive(e.target)) dragSource = target(e.target); }
  function onDrop(e) { if (active && dragSource && e.target instanceof Element) { const destination = target(e.target); if (destination) push("dragDrop", document.querySelector(dragSource.value) || null, { target2: destination }); dragSource = null; } }
  function onSubmit(e) { if (active && e.target instanceof HTMLFormElement) { for (const el of [...pendingInputs]) flushInput(el); push("submit", e.target); } }
  let scrollTimer;
  function onScroll() { if (!active) return; clearTimeout(scrollTimer); scrollTimer = setTimeout(() => push("scroll", null, { x: Math.round(window.scrollX), y: Math.round(window.scrollY) }), 300); }
  function stop() {
    if (!active) return; active = false;
    document.removeEventListener("click", onClick, true); document.removeEventListener("input", onInput, true); document.removeEventListener("change", onChange, true);
    document.removeEventListener("keydown", onKey, true); document.removeEventListener("submit", onSubmit, true); document.removeEventListener("contextmenu", onContextMenu, true);
    document.removeEventListener("dblclick", onDoubleClick, true); document.removeEventListener("mouseover", onMouseOver, true); document.removeEventListener("dragstart", onDragStart, true); document.removeEventListener("drop", onDrop, true); window.removeEventListener("scroll", onScroll, true);
    try { delete window[STATE_KEY]; } catch {}
  }
  window[STATE_KEY] = { stop };
  document.addEventListener("click", onClick, true); document.addEventListener("input", onInput, true); document.addEventListener("change", onChange, true);
  document.addEventListener("keydown", onKey, true); document.addEventListener("submit", onSubmit, true); document.addEventListener("contextmenu", onContextMenu, true);
  document.addEventListener("dblclick", onDoubleClick, true); document.addEventListener("mouseover", onMouseOver, true); document.addEventListener("dragstart", onDragStart, true); document.addEventListener("drop", onDrop, true); window.addEventListener("scroll", onScroll, true);
  window.__flowforgeRecorderLastMessage = { channel: CHANNEL, type: "ready", data: { url: location.href, title: document.title } };
})();
