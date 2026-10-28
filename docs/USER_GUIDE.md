# FlowForge User Guide

FlowForge is a Windows-focused desktop application for building visual browser-automation and data-processing workflows. This guide describes the features currently present in the repository, shows practical configurations, and identifies limitations that are not yet implemented. It is intentionally explicit: a documented example is not a promise that an unimplemented feature exists.

## Contents

- [1. Requirements and first launch](#1-requirements-and-first-launch)
- [2. The workflow canvas](#2-the-workflow-canvas)
- [3. Save, load, and validate workflows](#3-save-load-and-validate-workflows)
- [4. Node reference](#4-node-reference)
- [5. Variables and expressions](#5-variables-and-expressions)
- [6. Browser session and actions](#6-browser-session-and-actions)
- [7. Recorder and element picker](#7-recorder-and-element-picker)
- [8. Web scraping](#8-web-scraping)
- [9. Conditions and loops](#9-conditions-and-loops)
- [10. Reusable workflows and the library](#10-reusable-workflows-and-the-library)
- [11. JSON Field Detector and data formats](#11-json-field-detector-and-data-formats)
- [12. CSV and file output](#12-csv-and-file-output)
- [13. Run results, logs, and history](#13-run-results-logs-and-history)
- [14. Reliability, privacy, and security](#14-reliability-privacy-and-security)
- [15. Worked examples](#15-worked-examples)
- [16. Troubleshooting](#16-troubleshooting)
- [17. Current limitations](#17-current-limitations)

## 1. Requirements and first launch

### Requirements

- Node.js 22 or newer and npm 10 or newer for development.
- Google Chrome installed for Selenium-managed browser automation.
- Windows for final installer validation. Pure utilities and most unit tests can also run on Linux.

### Run from source

```bash
npm install
npm run dev
```

### Run checks

```bash
npm run typecheck
npm test
npm run test:browser
npm run lint
npm run build
```

The browser integration suite is opt-in locally. Enable it with:

```bash
# Linux/macOS
FLOWFORGE_CHROME_INTEGRATION=1 npm run test:browser

# PowerShell
$env:FLOWFORGE_CHROME_INTEGRATION = '1'
npm run test:browser
```

### Main interface areas

- **Canvas:** create and connect workflow nodes.
- **Inspector:** edit the selected node's configuration.
- **Variables:** create and maintain workflow variables.
- **Library:** save and reopen local workflow templates.
- **Runs:** review recent run summaries.
- **Quick Tools:** open the JSON Field Detector, launch the element picker, or add image extraction.

Names and layout may shift as the UI evolves. If a control is not visible in your build, consult the repository status before assuming it is available.

## 2. The workflow canvas

A workflow is a directed graph of nodes connected by edges. A valid workflow has exactly one `start` node. Edges define the normal execution path; `if` and `forEach` nodes have special output handles.

### Basic editing

1. Add a node from the action library or Quick Tools.
2. Select the node and configure it in the inspector.
3. Connect the nodes by dragging between their connection handles.
4. Use the canvas controls to zoom, pan, and inspect the graph.
5. Select a node to see its configuration and recent result styling.
6. Delete unwanted nodes from the inspector.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + C` | Copy selected nodes and internal edges |
| `Ctrl/Cmd + V` | Paste copied nodes and their internal edges |
| `Ctrl/Cmd + click` | Select multiple nodes for grouping |

Undo/redo and copy/paste are implemented, but should still be covered by full regression testing for the target release.

### Node groups

Select multiple nodes with `Ctrl` on Windows/Linux or `Cmd` on macOS to group them. Groups provide a visual label, not a separate execution scope.

### Validation

Before execution, FlowForge validates the workflow schema, node and edge IDs, start-node rules, graph cycles, supported node settings, variable names, and special condition/loop connections. Validation errors should be corrected before running.

## 3. Save, load, and validate workflows

Workflows use a versioned JSON format with `schemaVersion: 1`, an ID, name, node list, edge list, variables, and an optional update timestamp. The graph and node configuration are stored as data, not executable JavaScript.

A minimal structural example:

```json
{
  "schemaVersion": 1,
  "id": "example-workflow",
  "name": "Visit a page",
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "label": "Start",
      "position": { "x": 80, "y": 120 },
      "config": {}
    },
    {
      "id": "open-1",
      "type": "openUrl",
      "label": "Open page",
      "position": { "x": 320, "y": 120 },
      "config": { "url": "https://example.com" }
    }
  ],
  "edges": [
    { "id": "edge-1", "source": "start-1", "target": "open-1" }
  ],
  "variables": []
}
```

Use the app's save/load controls for normal work. If editing JSON manually, preserve the schema version and use unique IDs. Imported workflows are validated, and unsupported action types fail visibly instead of being silently treated as successful.

## 4. Node reference

Node configurations are edited in the inspector. The following reference describes the current node types and their main settings. Optional fields depend on the action.

### Start

- **Purpose:** workflow entry point.
- **Configuration:** none.
- **Rule:** exactly one start node per workflow; it cannot have incoming edges.

### Open URL (`openUrl`)

- **Purpose:** navigate the managed Chrome session to an HTTP(S) page.
- **Main setting:** `url`.
- **Example:** `https://example.com/catalog`.
- **Tip:** use a variable expression such as `{{variables.startUrl}}` for a configurable starting page.

### Click (`click`)

- **Purpose:** click a page element.
- **Settings:** `selector`, optional `strategy` (`css`, `xpath`, or `id`).
- **Example:** `selector: "button[type='submit']"`, `strategy: "css"`.
- **Tip:** use the Recorder to find candidate selectors and check that the chosen selector matches exactly the intended element.

### Type Text (`typeText`)

- **Purpose:** enter text into an input.
- **Settings:** `selector`, `text`, optional `strategy`, optional `clear` (defaults to clearing the existing value first).
- **Example:** `selector: "input[name='q']"`, `text: "FlowForge"`.
- **Variable example:** `text: "{{variables.searchTerm}}"`.

### Select Option (`selectOption`)

- **Purpose:** select a value in a native HTML `select` element.
- **Settings:** `selector`, string `value`, optional `strategy`.
- **Example:** `selector: "select[name='region']"`, `value: "eu"`.
- **Limitation:** this action is for native select controls, not custom JavaScript dropdowns.

### Wait For Element (`waitForElement`)

- **Purpose:** wait for an element to be present before proceeding.
- **Settings:** `selector`, optional `strategy`, `timeoutMs` (defaults to 10,000 ms in the action handler).
- **Example:** `selector: "main .results"`, `timeoutMs: 15000`.
- **Tip:** wait for a meaningful result container rather than sleeping for a fixed time when possible.

### Read Attribute (`readAttribute`)

- **Purpose:** read a DOM property/attribute and optionally store it.
- **Settings:** `selector`, `attribute` (defaults to `textContent`), optional `strategy`, optional `outputVariable`.
- **Example:** read `href` from `a.next-page` into `nextPageUrl`.

### Extract Text (`extractText`)

- **Purpose:** read text from a selected element or set of elements, depending on the selector implementation.
- **Settings:** optional `selector`, optional `outputVariable`.
- **Example:** select `h1` and save the result to `pageTitle`.

### Extract Links (`extractLinks`)

- **Purpose:** extract link text and destination information from matching anchors.
- **Settings:** optional `selector`, optional `outputVariable`.
- **Example:** `selector: "main a[href]"`, `outputVariable: "pageLinks"`.
- **Tip:** narrow the selector when you only want a particular link group.

### Extract Repeated Items (`extractItems`)

- **Purpose:** scrape repeated cards, list entries, or table rows into an array of objects.
- **Settings:** `itemSelector`, `fields` (field name to CSS selector map), optional `nextSelector`, `maxPages`, optional `outputVariable`.
- **Example fields:**

  ```json
  { "title": "h2", "link": "a[href]", "price": ".price" }
  ```

- **Pagination:** if configured, `nextSelector` identifies the control to click between pages. `maxPages` is an integer from 1 to 100. The node has a current-page preview that does not click pagination controls.
- **Safety bounds:** at most 500 matching item containers per page and 10,000 output rows total; duplicate rows are suppressed.
- **Tip:** inspect a page with Preview current page first, then run a small bounded extraction.

### Extract Images (`extractImages`)

- **Purpose:** collect image metadata from matching image elements.
- **Settings:** optional CSS `selector` (defaults to `img` in the action handler), optional `outputVariable`.
- **Captured fields:** resolved source URL, alt text, title, dimensions, loading mode, and completion state.
- **Safety bound:** up to 2,000 images.
- **Limitation:** this extracts metadata. It does not download the image files or perform OCR.

### Set Variable (`setVariable`)

- **Purpose:** resolve an expression and assign it to a variable.
- **Settings:** `name`, `value`.
- **Example:** `name: "searchTerm"`, `value: "wireless keyboard"`.
- **Tip:** define variables in the Variables panel when a value should be easy to edit or reused.

### If (`if`)

- **Purpose:** route execution down a true or false edge.
- **Settings:** `left`, `operator`, and optional `right`.
- **Operators:** `equals`, `notEquals`, `contains`, `greaterThan`, `lessThan`, `isTruthy`.
- **Example:** `left: "{{variables.resultCount}}"`, `operator: "greaterThan"`, `right: 0`.
- **Important:** connect outgoing edges to the explicit `true` and `false` handles. Numeric operators require finite numeric values. `contains` supports a string or array on the left.

### For Each (`forEach`)

- **Purpose:** run a configured list of inline actions for each element of an array.
- **Settings:** `items`, `maxItems`, and `actions`.
- **Example:**

  ```json
  {
    "items": "{{variables.products}}",
    "maxItems": 100,
    "actions": [
      { "type": "log", "config": { "message": "{{item.title}}" } }
    ]
  }
  ```

- **Safety bounds:** each loop's `maxItems` is capped at 10,000; total iterations across nested loops and called subworkflows are capped at 10,000 per run.
- **Cancellation:** cancellation is checked between iterations and inline actions.
- **Limitation:** loop bodies use inline action definitions. A dedicated graph-loop body editor is not implied by this node.

### Write File (`writeFile`)

- **Purpose:** write configured content to an output file.
- **Settings:** filename/path and content settings exposed by the node inspector.
- **Safety:** output paths and content are validated by the main-process handler. Atomic temporary-file replacement is used where implemented.
- **Tip:** test with a small, known output before writing large files.

### Export CSV (`exportCsv`)

- **Purpose:** export an array of row objects to a CSV file.
- **Settings:** rows, filename, and other fields exposed in the inspector.
- **Example rows expression:** `{{variables.products}}`.
- **Safety:** output is capped at 50 MB, unsafe filenames are rejected, and the CSV encoder handles quoting.

### Log (`log`)

- **Purpose:** write a message into the current run's log.
- **Settings:** `message`.
- **Example:** `Processed {{variables.rowCount}} products`.
- **Note:** run logs are returned for the active run, but variable values and logs are intentionally not persisted in run history.

### Run Workflow (`subworkflow`)

- **Purpose:** call a saved or embedded workflow and pass selected values back to the parent.
- **Settings:** `workflow` (workflow object), optional `inputs`, optional `outputs`, optional `outputVariable`.
- **Input example:** `{ "startUrl": "{{variables.url}}" }`.
- **Output example:** `{ "productTitle": "title" }` maps the parent variable `productTitle` to the child variable `title`.
- **Compatibility:** `outputVariable`, when set, receives the complete child variable object.
- **Safety:** nesting is limited to 10 levels; the child must succeed for the call to succeed; missing requested output variables fail clearly.

## 5. Variables and expressions

The Variables panel lets you add, edit, type, and remove workflow variables. Supported declared types are `string`, `number`, `boolean`, `object`, `array`, and `secret`. Variable metadata also has a scope field (`workflow`, `run`, `item`, or `environment`), but full independent runtime semantics for every scope, secret masking, and environment injection are not complete. Treat these scope labels as metadata unless your build explicitly implements additional behavior.

### Variable names

Names must begin with a letter or underscore and then contain letters, numbers, or underscores. Reserved prototype-related names such as `__proto__`, `prototype`, and `constructor` are rejected. Duplicate variable declarations are invalid.

### Referencing a variable

Use the expression form:

```text
{{variables.startUrl}}
{{variables.searchTerm}}
{{variables.products}}
```

Expressions are supported in action configuration values. The runtime resolves nested object paths and supports loop context expressions such as `{{item.title}}` and `{{index}}` inside loop actions.

### Example variable set

```json
[
  { "name": "startUrl", "type": "string", "value": "https://example.com" },
  { "name": "searchTerm", "type": "string", "value": "keyboard" },
  { "name": "maxProducts", "type": "number", "value": 25 }
]
```

### Practical pattern

1. Store editable inputs in variables rather than repeating literals.
2. Use `setVariable` to transform or assign values during a run.
3. Store extraction results in an `outputVariable`.
4. Use those results as the input to loops, conditions, logs, or CSV export.

Do not store passwords or API tokens in ordinary workflow JSON. Secret masking and secure environment-variable injection are not yet complete.

## 6. Browser session and actions

Browser nodes operate on FlowForge's managed Selenium Chrome session. Start the managed browser before running a workflow that requires a page. The browser session is reused by browser actions within that run and is stopped during cleanup.

### Selector strategies

- **CSS:** usually the easiest option for stable attributes and classes.
- **XPath:** useful for text or relationships when CSS is insufficient.
- **ID:** use a known unique element ID.

Prefer selectors based on stable application-owned attributes such as `data-testid`, `name`, or a stable ID. Avoid brittle selectors that encode long chains of layout elements.

### Browser actions at a glance

A typical search workflow is:

1. `openUrl` with a page URL.
2. `waitForElement` for the search input.
3. `typeText` with the search term.
4. `click` the submit button.
5. `waitForElement` for the results container.
6. `extractText` or `extractItems` to collect results.
7. `exportCsv` to save the output.

### Browser availability

The current automation integration is Selenium-based and requires Chrome. Headless mode is enabled in CI and can be requested locally with `FLOWFORGE_HEADLESS=1`.

## 7. Recorder and element picker

The Recorder helps discover a locator for an element and can turn a captured interaction into an editable node.

### Pick an element

1. Start the managed Chrome browser and open the target page.
2. Choose the element recorder / Record next control.
3. In the recorder window, use **Alt+click** on the target element.
4. Inspect candidate locators and their match counts.
5. Prefer a unique, stable selector.
6. Test the locator before adding the action to the workflow.
7. Press Escape to cancel selection.

The picker displays a red overlay at approximately 40% opacity while selection is active. Candidate strategies include IDs, CSS paths, XPath paths, test attributes, names, and accessible-name/title/text-oriented XPath candidates.

### Captured interactions

The one-action recorder can capture click actions, text-input changes, native select changes, and HTTP(S) anchor navigation, then insert the corresponding editable workflow node.

### Limits

- One action is captured per request.
- Pause/resume and multi-step recording/replay are not complete.
- Iframe selection is not complete.
- Locator quality varies by site; always test candidates.
- Recorder support is not a guarantee that every website's event pattern can be captured.

## 8. Web scraping

### Extract repeated items

Use **Extract repeated items** for a page with repeated cards, table rows, or list items. The `itemSelector` matches one container per result. Each field selector is evaluated inside that container.

Example page structure:

```html
<article class="product-card">
  <h2>Wireless Keyboard</h2>
  <a href="/products/keyboard">View product</a>
  <span class="price">39.99</span>
</article>
```

Configuration:

```json
{
  "itemSelector": "article.product-card",
  "fields": {
    "title": "h2",
    "link": "a[href]",
    "price": ".price"
  },
  "maxPages": 1,
  "outputVariable": "products"
}
```

The extracted data is an array of objects. Use the Preview current page control to inspect a sample before running the workflow.

### Pagination

To follow a next-page control, set `nextSelector` to a stable selector for that control and set `maxPages` to a small, explicit bound. The maximum accepted value is 100. Check that the selector stops matching on the final page and that the page does not contain a self-referencing or unexpected link.

### Extract links

Use `extractLinks` for anchor metadata rather than repeated card extraction. Scope the selector to a content region, for example `main article a[href]`, to avoid collecting navigation and footer links.

### Extract image metadata

Use `extractImages` with a selector such as `main img`. It records metadata, including resolved image source, alt/title, dimensions, loading mode, and completion state. It does not download the bytes or read text from images.

### Responsible scraping

Only access pages you are authorized to use. Respect site terms, rate limits, authentication boundaries, and applicable privacy rules. Start with low page and item limits. Avoid scraping personal or sensitive information without a valid basis.

## 9. Conditions and loops

### Condition example

Suppose an extraction result is stored in `products`. A condition can branch based on a value configured in the node. The supported comparison operators are:

| Operator | Meaning |
|---|---|
| `equals` | Values are identical under JavaScript `Object.is` semantics |
| `notEquals` | Values are not identical |
| `contains` | String contains a substring, or array contains the exact value |
| `greaterThan` | Numeric left side is greater than numeric right side |
| `lessThan` | Numeric left side is less than numeric right side |
| `isTruthy` | Left side is converted to a boolean |

Connect the true and false outputs deliberately. An unconnected branch will not run. Numeric comparisons reject values that cannot be converted to finite numbers.

### Loop example

For each product, write a log line:

```json
{
  "items": "{{variables.products}}",
  "maxItems": 100,
  "actions": [
    {
      "type": "log",
      "config": { "message": "Product {{item.title}} at {{item.price}}" }
    }
  ]
}
```

`index` is available in loop context. Keep `maxItems` as low as the task allows. Nested loops and loops inside subworkflows share the 10,000-iteration budget for a run.

## 10. Reusable workflows and the library

The local Library stores workflow definitions in the current app profile. It is useful for templates and repeated tasks on the same machine. It is not a cloud-sync service and does not share items across devices.

### Save and reuse

1. Create and validate a workflow.
2. Save a copy in the Library.
3. Load it later as a starting point or select it in a Run Workflow node.
4. Configure inputs and selected outputs.
5. Test the parent workflow with representative inputs.

### Input mapping

The subworkflow receives the configured `inputs` object as its initial variables. For example:

```json
{
  "inputs": {
    "startUrl": "{{variables.targetUrl}}",
    "searchTerm": "{{variables.query}}"
  }
}
```

### Output mapping

Map parent variable names to child variable names:

```json
{
  "outputs": {
    "firstProductTitle": "title",
    "allProducts": "products"
  }
}
```

The child must define those variables by the time it finishes. A requested missing output is an error. The older `outputVariable` option captures the full child variable object for compatibility.

### Portability

The selected workflow definition is embedded in the subworkflow node, allowing the node configuration to carry the child definition. Library entries themselves remain local to the app profile. There is no library version/dependency manager yet.

## 11. JSON Field Detector and data formats

Open **JSON Field Detector** from Quick Tools. It can inspect JSON, CSV, or TXT input, detect field paths/types/presence, and export a field report as JSON, CSV, or TXT.

### JSON example

Input:

```json
{
  "customer": { "id": 42, "name": "Ada" },
  "orders": [
    { "id": "A-100", "total": 25.5 },
    { "id": "A-101", "total": 12 }
  ]
}
```

Typical detected paths include `customer.id`, `customer.name`, `orders[].id`, and `orders[].total`. Presence counts describe how often a path was observed across inspected records.

### CSV example

```csv
id,title,price
101,"Keyboard, wireless",39.99
102,Mouse,14.50
```

Quoted commas and escaped quotes are handled by the CSV utility. If you need consistent output columns, normalize rows before export.

### TXT example

```text
first line
second line
third line
```

Text input is split into lines for field inspection. It is not a general-purpose PDF, Word, or OCR parser.

### Error handling

Malformed JSON and invalid CSV input should be corrected at the source; the detector surfaces parsing errors rather than inventing fields. Use small samples first for very large inputs.

## 12. CSV and file output

### Export a result array

If `extractItems` stores rows in `products`, configure `exportCsv` to use `{{variables.products}}` and a `.csv` output filename.

Example data:

```json
[
  { "title": "Wireless Keyboard", "price": "39.99" },
  { "title": "Mouse", "price": "14.50" }
]
```

Example CSV output:

```csv
title,price
Wireless Keyboard,39.99
Mouse,14.50
```

The built-in CSV encoder quotes values containing commas, quotes, or newlines and escapes embedded quotes. CSV output is limited to 50 MB. Unsafe filenames are rejected.

### Atomic writes

Where the file-writing path uses atomic replacement, FlowForge writes to a temporary file and then renames it into place. This reduces the chance that a crash leaves a partially written destination. Atomic rename guarantees depend on the filesystem and platform; do not treat it as a substitute for backups.

## 13. Run results, logs, and history

The execution engine returns a status (`succeeded`, `failed`, or `cancelled`), step results, variables, logs, and an optional error. Step results include node ID, status, start time, duration, and optional output/error. The UI uses node result styling to help locate failures.

### Recent run history

FlowForge stores up to 50 recent run summaries in the app's user-data directory. A summary includes workflow name, timestamp, duration, status, step count, and an optional error message.

Run history intentionally excludes variable values and execution logs. This keeps sensitive workflow data out of the durable summary, but it also means history is not a full replay/debug trace.

### Cancellation and bounds

Cancellation is checked between workflow actions and loop iterations. A cancelled run should report `cancelled`, and cleanup attempts to stop the managed browser. A workflow has a bounded step count, nested workflow calls are limited to 10 levels, and loops share a 10,000-iteration ceiling.

## 14. Reliability, privacy, and security

### Security design

The desktop foundation uses Electron context isolation, disables Node integration in the renderer, uses a sandboxed preload, applies a restrictive Content Security Policy, validates IPC senders, and bounds file inputs/outputs. Do not bypass these controls for convenience.

### Data safety

Workflow and run-summary persistence use validation and atomic replacement where implemented. Non-serializable workflow data is rejected instead of being silently written. Failed writes should be surfaced as errors.

### Secrets

The `secret` variable type exists in the schema, but complete secret masking and environment injection are not implemented. Do not put real credentials into exported workflow files, screenshots, logs, or support bundles. Use test accounts and synthetic data while developing.

### Backups

Keep versioned copies of important workflow JSON files outside the app profile. The local Library is not a backup or cross-device sync mechanism.

## 15. Worked examples

These examples describe node configurations and intended wiring. Node IDs and positions are illustrative. When importing a complete workflow, make sure each node has a unique ID and each edge references existing nodes.

### Example A: Open a page and extract the title

1. `start`
2. `openUrl` with `url: "https://example.com"`
3. `waitForElement` with `selector: "h1"`
4. `extractText` with `selector: "h1"`, `outputVariable: "pageTitle"`
5. `log` with `message: "Title: {{variables.pageTitle}}"`

Use a page you are authorized to access. If a site renders content asynchronously, wait for its actual result container.

### Example B: Search a page

Variables:

```json
[
  { "name": "startUrl", "type": "string", "value": "https://example.com/search" },
  { "name": "searchTerm", "type": "string", "value": "wireless keyboard" }
]
```

Node sequence:

1. `openUrl`: `url = {{variables.startUrl}}`
2. `waitForElement`: `selector = input[name='q']`
3. `typeText`: `selector = input[name='q']`, `text = {{variables.searchTerm}}`
4. `click`: `selector = button[type='submit']`
5. `waitForElement`: `selector = main .results`
6. `extractText`: `selector = main .results`, `outputVariable = resultsText`
7. `log`: `message = {{variables.resultsText}}`

Replace the example selectors with the real page's selectors. This is a pattern, not a site-specific guarantee.

### Example C: Scrape a product listing to CSV

1. `openUrl`: open the listing page.
2. `waitForElement`: wait for `article.product-card`.
3. `extractItems`:

   ```json
   {
     "itemSelector": "article.product-card",
     "fields": {
       "title": "h2",
       "link": "a[href]",
       "price": ".price"
     },
     "maxPages": 1,
     "outputVariable": "products"
   }
   ```

4. `exportCsv`: rows = `{{variables.products}}`, filename = `products.csv`.
5. Inspect the generated file and validate a few rows before using it downstream.

For pagination, add `nextSelector` and a small `maxPages` only after verifying the next-page behavior.

### Example D: Process extracted rows with a loop

Assume `products` is already an array. Add a `forEach` node with:

```json
{
  "items": "{{variables.products}}",
  "maxItems": 50,
  "actions": [
    {
      "type": "log",
      "config": { "message": "{{index}}: {{item.title}}" }
    }
  ]
}
```

This logs each row title. For large arrays, keep the cap low and export the full rows rather than logging every field.

### Example E: Reuse a child workflow

Child workflow:

- accepts `startUrl` as an initial variable,
- opens the URL,
- extracts the page heading into variable `title`.

Parent Run Workflow node:

```json
{
  "inputs": { "startUrl": "{{variables.targetUrl}}" },
  "outputs": { "pageTitle": "title" }
}
```

After the child completes, the parent can use `{{variables.pageTitle}}`. The child must actually set `title`, or the call fails with a missing-output error.

### Example F: Branch on a known value

Configure an `if` node with `left` set to a known value, `operator: "equals"`, and `right` set to the expected value. Connect the `true` handle to the success path and the `false` handle to a fallback/logging path. Test both paths with different inputs.

## 16. Troubleshooting

### Workflow validation fails

- Confirm exactly one `start` node exists.
- Remove duplicate node IDs, edge IDs, and variable names.
- Ensure every edge source/target exists.
- Remove graph cycles.
- Connect `if` edges using `true` or `false` handles and loop edges using `item` or `done` handles.
- Check required selectors, URLs, field maps, and bounds.

### A browser selector cannot be found

- Confirm the managed Chrome session is open on the expected page.
- Wait for the actual target element.
- Use the Recorder to inspect candidates and match counts.
- Prefer a unique stable attribute; avoid brittle positional selectors.
- Check whether the target is inside an iframe, which is a current recorder limitation.

### Extraction returns no rows

- Verify `itemSelector` matches each repeated container, not the whole page.
- Verify each field selector works relative to a container.
- Use Preview current page and inspect a small sample.
- Confirm pagination controls and `maxPages`.

### Subworkflow output is missing

- Verify the child workflow creates the variable with the exact mapped name.
- Check spelling and case.
- Confirm the child run succeeds before the output is mapped.

### Chrome integration tests fail

- Install project dependencies and Google Chrome.
- Set `FLOWFORGE_CHROME_INTEGRATION=1` for the local opt-in suite.
- Use CI's headless mode for automation environments.
- Read the first failing assertion carefully; distinguish an incorrect test expectation from an extraction bug.

### Windows packaging fails

- Run `npm run build` first.
- Confirm the CI secret `GH_TOKEN` is configured only if the packaging path needs to publish a release.
- Inspect the Windows job log for the actual installer failure; do not infer success from the quality job alone.

## 17. Current limitations

The following capabilities are not complete and should not be described as release-ready without further implementation and verification:

- Retry/try-catch graph nodes and checkpoint/resume.
- Full runtime semantics for workflow/run/item/environment variable scopes, secret masking, and environment injection.
- Multi-step recorder pause/resume/replay and iframe support.
- Image downloading and OCR.
- Library dependency/version tracking and cloud/cross-device synchronization.
- Scheduling, multi-project management, and full accessibility/E2E coverage.
- Complete Windows install/uninstall smoke testing and independent end-to-end review.

Consult `STATUS.md` and `IMPLEMENTATION_PLAN.md` for the current development and verification status. A feature being described here does not imply that every platform combination has been tested.
