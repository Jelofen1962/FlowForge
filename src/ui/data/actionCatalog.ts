import type { StepType } from "../../core/workflow";

/** Single source of truth for the actions available in the editor. */
export const stepTypes: [StepType,string][] = [
  ["navigate","Navigate to URL"],["click","Click element"],["type","Type text"],["key","Keyboard shortcut"],
  ["hover","Hover over element"],["rightClick","Right-click element"],["doubleClick","Double-click element"],["dragDrop","Drag and drop"],["scrollTo","Scroll to element"],["scroll","Scroll page"],
  ["waitVisible","Wait until visible"],["waitClickable","Wait until clickable"],["wait","Wait / pause"],["waitDownload","Wait for download"],
  ["assertText","Assert text"],["assertUrl","Assert URL"],["assertExists","Assert element exists"],["assertCount","Assert element count"],["assertTitle","Assert page title"],["assertAttribute","Assert attribute"],
  ["select","Select option"],["uploadFile","Upload file"],["extractText","Extract element text"],["extractAttribute","Extract attribute"],["extractValue","Extract input value"],["extractTable","Extract table to CSV"],["saveText","Save text output"],["saveImage","Save image from element"],["screenshot","Take screenshot"],["saveSession","Save browser session"],["loadSession","Load saved browser session"],
  ["alertAccept","Accept browser alert"],["alertDismiss","Dismiss browser alert"],["openTab","Open new tab"],["closeTab","Close current tab"],["switchWindow","Switch browser tab"],["switchFrame","Switch into frame"],["switchFrameDefault","Return to main page from frame"],
  ["setVariable","Set variable"],["regexReplace","Regex edit variable"],["extractAll","Extract all matching elements"],["operateAll","Operate on all matching elements"],["ifElse","If / else block"],["repeat","Repeat steps"],["loopList","Loop over list"],["while","While condition is true"],["breakLoop","Break loop"],["continueLoop","Continue loop"],["userInput","Ask user for inputs"],["runWorkflow","Run another workflow"],["back","Go back"],["forward","Go forward"],["refresh","Refresh page"]
];

export const actionGroups: { label: string; types: StepType[] }[] = [
 { label: "Navigation", types: ["navigate","back","forward","refresh","openTab","closeTab","switchWindow"] },
 { label: "Interaction", types: ["click","type","key","hover","rightClick","doubleClick","dragDrop","scrollTo","scroll","select","uploadFile","alertAccept","alertDismiss","switchFrame","switchFrameDefault"] },
 { label: "Waits & checks", types: ["waitVisible","waitClickable","wait","waitDownload","assertText","assertUrl","assertExists","assertCount","assertTitle","assertAttribute"] },
 { label: "Extract & save", types: ["extractText","extractAttribute","extractValue","extractTable","extractAll","saveText","saveImage","screenshot","saveSession","loadSession"] },
 { label: "Logic & data", types: ["ifElse","repeat","loopList","while","breakLoop","continueLoop","setVariable","regexReplace","operateAll","userInput","runWorkflow"] },
];
