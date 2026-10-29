# Phase 3: Browser recorder and locator reliability

## Delivered in this increment

- Browser actions can target an iframe by CSS selector using the optional `frameSelector` field on click, type, select-option, wait-for-element, and read-attribute nodes.
- Frame actions always return WebDriver to the top-level document, including when the target is missing or an action throws.
- The existing locator picker now adds semantic XPath candidates based on explicit ARIA roles or implicit HTML roles and accessible names, alongside IDs, stable attributes, CSS paths, text, and title/ARIA-label candidates.
- Browser navigation remains limited to HTTP and HTTPS. Integration coverage asserts rejected schemes do not kill the managed session.
- Integration coverage includes navigation, DOM extraction, link navigation recording, native select changes, click/type/select recording, semantic locator candidates, iframe actions, pagination, and idempotent shutdown.
- The node inspector exposes `frameSelector` as an editable setting for supported browser action nodes. Leave it blank for the top-level document.

## Frame locator contract

`frameSelector` is a CSS selector for an `iframe` or `frame` element in the top-level document. The regular `selector` and `strategy` identify the target inside that frame. Nested iframe chains are not supported in this increment. Scraping and DOM snapshot actions remain top-level-document operations.

## Acceptance checklist

- [x] Frame-aware click/type/select/wait/read operations restore the top-level document in `finally`.
- [x] Frame selector length is bounded and workflow validation rejects invalid frame-selector types.
- [x] Semantic XPath candidates are generated with match counts for role/name-like lookup.
- [x] Integration tests cover unsafe URL rejection and idempotent browser shutdown.
- [x] Integration test covers successful iframe lookup/action and recovery after a missing iframe target.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` in a dependency-enabled environment.
- [ ] Run `FLOWFORGE_CHROME_INTEGRATION=1 npm run test:browser` with Chrome and its driver available.
- [ ] Manually verify picker, recorder, iframe forms, and keyboard cancellation against representative real sites.

## Known boundaries

- Frame targeting is explicit and CSS-only; nested frames and iframe-aware scraping/picking are not implemented.
- Accessible-name XPath candidates are pragmatic candidates, not a complete WAI-ARIA accessible-name computation. Use the Test locator action and prefer candidates with exactly one match.
- Integration tests are added but not claimed as executed in this workspace because dependencies are unavailable.
