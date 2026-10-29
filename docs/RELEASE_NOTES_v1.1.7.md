# FlowForge v1.1.7

## Canvas and workflow editing

- Enlarged node cards and connection handles for easier selection and wiring.
- Added arrowheads and selectable curved, right-angle, and straight connection styles.
- Alt-click a connection to toggle between right-angle and curved routing.
- Left-drag empty canvas to box-select; right-drag to pan.
- Added right-click context menus for editing, copying, duplicating, deleting, grouping, separating, adding, and pasting nodes.
- Added Ctrl/Cmd+D duplicate, Ctrl/Cmd+G group, Delete/Backspace delete, and Ctrl+middle-click to focus the Start node.
- Newly created nodes are selected and centered automatically.
- Added a workspace home dashboard with new workflow, current workflow, and saved library shortcuts.
- Workflow renaming now has a visible hover/focus background.

## Compatibility note

Connection bend styles are editor presentation settings; the workflow schema continues to store source/target connectivity. Verify interaction behavior in the packaged Windows build before publishing.
