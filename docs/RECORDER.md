# Workflow recorder

FlowForge's recorder opens the configured site in the real Chrome or Edge WebDriver session and observes interactions while the user operates the page normally. It does not cancel clicks or require the user to select an element manually.

## Start and edit a recording

1. Enter an HTTP(S) site URL in the URL field at the top of the app.
2. Press **Record**. After confirmation, the current workflow's steps are replaced with a new recording that begins with an editable **Open website** step.
3. Interact with the site as usual. Captured actions are added to the selected workflow immediately.
4. Press **Stop recording**. The generated steps remain in the workflow editor, where names, locators, values, ordering, retry behavior, and other supported step settings can be changed.
5. Review the workflow before running it. A recording is a best-effort sequence of observed browser events, not a guarantee that a site will behave identically on replay.

## Recorded interactions

- Clicks on links, buttons and common interactive controls
- Text entry, captured after typing settles (the final field value is used)
- Select/dropdown changes
- Checkbox and radio toggles
- Keyboard keys and common modifier shortcuts
- Right-click and double-click
- Hover on common interactive elements
- Page scrolling
- Supported HTML drag-and-drop interactions
- URL changes after page navigation and single-page-app navigation

Selectors prefer unique IDs, `data-testid`, `data-test`, `name`, accessible labels and placeholders before falling back to a CSS path. Captured steps are regular FlowForge workflow steps and can be edited like manually-created steps.

## Privacy and limitations

- Password fields and fields whose metadata resembles payment, one-time-code, token, or secret inputs are excluded from captured values. This is a heuristic, not a guarantee; review the recording and logs before sharing them.
- File-picker dialogs are native operating-system UI and cannot expose the selected local path to the page recorder. Add or edit an `Upload file` step manually when needed.
- Browser chrome, tab-strip interactions, browser extensions, CAPTCHA, canvas drawing, some cross-origin iframe interactions, custom widgets, and application-specific gestures may not be recorded reliably.
- Sites can change their DOM, use unstable selectors, or depend on timing, authentication, network state, and data that differs on replay. Add waits and assertions where needed.
- Recording uses the local browser and local engine; it does not record the user's entire desktop or other applications.
