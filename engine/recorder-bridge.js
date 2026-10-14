/**
 * FlowForge browser recorder bridge.
 *
 * This module is injected into the real page controlled by Selenium. It draws a
 * 40%-opacity red hover overlay, supports click-to-select, and reports selectors
 * through a validated, namespaced postMessage event. It never embeds the page.
 */
"use strict";

(() => {
  const CHANNEL = "FLOWFORGE_RECORDER_V1";
  const OVERLAY_ID = "__flowforge_recorder_overlay__";
  const STYLE_ID = "__flowforge_recorder_style__";
  const HOVER_ID = "__flowforge_recorder_hover__";
  const STATE_KEY = "__flowforgeRecorderStateV1";
  const previous = window[STATE_KEY];
  if (previous && typeof previous.stop === "function") previous.stop();

  let active = true;
  let currentTarget = null;
  let overlay = null;
  let hoverLabel = null;
  const originalCursor = document.documentElement.style.cursor;

  function isOwnNode(node) {
    return !!(node && node.nodeType === 1 &&
      (node.id === OVERLAY_ID || node.id === HOVER_ID || node.closest?.(`#${OVERLAY_ID}, #${HOVER_ID}`)));
  }

  function xpathLiteral(value) {
    if (!value.includes("'")) return `'${value}'`;
    if (!value.includes('"')) return `"${value}"`;
    const parts = value.split("'");
    return `concat(${parts.map((part, index) => `${index ? `,"'",` : ""}'${part}'`).join("")})`;
  }

  function elementXPath(element) {
    if (element.id && document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) {
      return `//*[@id=${xpathLiteral(element.id)}]`;
    }
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(child => child.tagName === node.tagName);
        if (sameTag.length > 1) part += `[${sameTag.indexOf(node) + 1}]`;
      }
      parts.unshift(part);
      node = parent;
    }
    return `/${document.documentElement.tagName.toLowerCase()}/${parts.join("/")}`;
  }

  function cssSelector(element) {
    if (element.id && document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) {
      return `#${CSS.escape(element.id)}`;
    }
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part += `#${CSS.escape(node.id)}`;
        parts.unshift(part);
        break;
      }
      const stable = Array.from(node.classList || [])
        .filter(name => /^[A-Za-z_-][\w-]*$/.test(name) && !/^(active|selected|hover|focus|ng-|css-)/i.test(name))
        .slice(0, 2);
      if (stable.length) part += stable.map(name => `.${CSS.escape(name)}`).join("");
      const parent = node.parentElement;
      if (parent) {
        const peers = Array.from(parent.children).filter(child =>
          child.tagName === node.tagName && child.className === node.className);
        if (peers.length > 1) part += `:nth-of-type(${Array.from(parent.children).filter(child => child.tagName === node.tagName).indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function safeText(element) {
    return String(element.innerText || element.getAttribute("aria-label") ||
      element.getAttribute("placeholder") || element.getAttribute("title") || "")
      .replace(/\s+/g, " ").trim().slice(0, 160);
  }

  function describe(element) {
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || "",
      name: element.getAttribute("name") || "",
      text: safeText(element),
      xpath: elementXPath(element),
      css: cssSelector(element),
      attributes: {
        role: element.getAttribute("role") || "",
        type: element.getAttribute("type") || "",
        ariaLabel: element.getAttribute("aria-label") || "",
        placeholder: element.getAttribute("placeholder") || "",
        href: element instanceof HTMLAnchorElement ? element.href : ""
      }
    };
  }

  function post(type, data = {}) {
    const message = { channel: CHANNEL, type, data };
    if (!(type === "stopped" && window.__flowforgeRecorderLastMessage?.type === "selected")) {
      window.__flowforgeRecorderLastMessage = message;
    }
    window.postMessage(message, "*");
  }

  function install() {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} { position: fixed !important; inset: 0 !important; z-index: 2147483646 !important; cursor: crosshair !important; pointer-events: none !important; }
      #${HOVER_ID} { position: fixed !important; z-index: 2147483647 !important; background: rgba(255,0,0,.4) !important; outline: 1px solid rgba(255,0,0,.95) !important; pointer-events: none !important; box-sizing: border-box !important; }
      #${HOVER_ID}::after { content: attr(data-flowforge-label); position: absolute; left: 0; top: 0; transform: translateY(-100%); background: #d90000; color: white; font: 12px/1.4 sans-serif; padding: 2px 6px; white-space: nowrap; max-width: 60vw; overflow: hidden; text-overflow: ellipsis; }
    `;
    (document.head || document.documentElement).appendChild(style);
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    document.documentElement.appendChild(overlay);
    hoverLabel = document.createElement("div");
    hoverLabel.id = HOVER_ID;
    hoverLabel.hidden = true;
    document.documentElement.appendChild(hoverLabel);
    document.documentElement.style.cursor = "crosshair";
  }

  function isCandidate(element) {
    return element instanceof Element && !isOwnNode(element) &&
      !["HTML", "BODY", "HEAD", "STYLE", "SCRIPT"].includes(element.tagName);
  }

  function onMove(event) {
    if (!active) return;
    const target = event.composedPath().find(item => isCandidate(item));
    if (!(target instanceof Element)) return;
    currentTarget = target;
    const rect = target.getBoundingClientRect();
    hoverLabel.hidden = false;
    hoverLabel.style.left = `${Math.max(0, rect.left)}px`;
    hoverLabel.style.top = `${Math.max(0, rect.top)}px`;
    hoverLabel.style.width = `${Math.max(1, rect.width)}px`;
    hoverLabel.style.height = `${Math.max(1, rect.height)}px`;
    hoverLabel.dataset.flowforgeLabel = `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ""}`;
  }

  function onClick(event) {
    if (!active || !currentTarget || isOwnNode(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const data = describe(currentTarget);
    post("selected", data);
    // One-shot selection avoids accidentally intercepting the next real user click.
    stop();
  }

  function stop() {
    if (!active) return;
    active = false;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(HOVER_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.documentElement.style.cursor = originalCursor;
    post("stopped");
    try { delete window[STATE_KEY]; } catch {}
  }

  window[STATE_KEY] = { stop };
  install();
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  post("ready", { url: location.href, title: document.title });
})();
