# Advanced actions and workflow outputs

## Browser actions

FlowForge supports click, type, keyboard shortcuts, hover, right-click, double-click, drag-and-drop, scroll-to-element, page scroll, navigation/back/forward/refresh, new/close/switch tab, frame switching, browser alert accept/dismiss, select, file upload, and download waiting. Actions use CSS, XPath, ID, name, link text, class name, or tag-name locators where appropriate.

## Data extraction and assertions

- `extractText`, `extractAttribute`, and `extractValue` write text artifacts and expose the result as a workflow variable named by `outputName`.
- `extractTable` exports a located HTML table as CSV and also stores a JSON string in a workflow variable.
- `saveText` writes arbitrary text after variable substitution.
- `saveImage` saves a screenshot of the located element; `screenshot` captures the page.
- Assertions include element text, current URL substring, element existence, element count, page title substring, and exact attribute value.

## Control flow

- Per-step conditions can skip an action when the condition is false.
- `ifElse` executes `thenSteps` or `elseSteps` based on a condition.
- `repeat` executes nested steps a fixed number of times (1-1000).
- `loopList` iterates comma-separated values or a JSON array, placing each item in `itemVariable`.
- `while` repeats while a condition remains true, with a hard maximum of 1-1000 iterations.
- `breakLoop` and `continueLoop` control an enclosing loop.
- Nested action blocks are represented as step arrays in workflow JSON. The editor currently exposes these arrays in a JSON field; a visual nested-block canvas is future UX work.

## Output ZIPs

Each run gets a separate output directory and ZIP archive under Electron's user-data directory in `outputs/<workflow-id>/`. Downloads are directed to the run directory. Screenshots, extracted text/attributes/values, CSV tables, saved text and image captures are included in the archive. The Outputs panel lists per-workflow archives, previews supported text/image artifacts, opens the ZIP, reveals it in Explorer, and deletes an archive with its associated preview folder.

Per-file output is capped at 100 MB and in-app previews at 10 MB. ZIPs and outputs may contain private data; review before sharing. Output files are local and are not encrypted.

## Known boundaries

- Upload requires a local absolute file path. Download detection watches the workflow output directory and can filter by a filename substring.
- `saveImage` captures the selected element as a PNG screenshot, not necessarily the original remote image bytes.
- Browser alert actions require an alert to be present at that moment.
- Window switching uses a zero-based tab index.
- Full UI, Chrome/Edge integration, Windows packaging, and full Vitest suite still need validation on a machine with project dependencies installed.
