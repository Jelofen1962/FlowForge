import type { StepType } from "../../core/workflow";
import { actionGroups } from "../data/actionCatalog";
import { ChevronDown } from "../AnimatedIcons";

type ActionOption = [StepType, string];
type Props = {
  value: StepType;
  actions: ActionOption[];
  translate: (value: string) => string;
  onChange: (value: StepType) => void;
  className?: string;
};

const actionEmoji: Partial<Record<StepType, string>> = {
  navigate:"🌐", back:"↩️", forward:"↪️", refresh:"🔄", openTab:"🗂️", closeTab:"✖️", switchWindow:"🪟",
  click:"🖱️", type:"⌨️", key:"⌨️", hover:"👆", rightClick:"🖱️", doubleClick:"🖱️", dragDrop:"↔️", scrollTo:"🎯", scroll:"📜",
  waitVisible:"👁️", waitClickable:"🟢", wait:"⏱️", waitDownload:"📥", assertText:"🔎", assertUrl:"🔗", assertExists:"✅", assertCount:"🔢", assertTitle:"🏷️", assertAttribute:"🧩",
  select:"📋", uploadFile:"📤", extractText:"📝", extractAttribute:"🧩", extractValue:"📥", extractTable:"📊", saveText:"💾", saveImage:"🖼️", screenshot:"📸", saveSession:"🍪",
  setVariable:"📦", regexReplace:"🧹", extractAll:"📚", operateAll:"⚙️", ifElse:"🔀", repeat:"🔁", loopList:"📃", while:"🔄", breakLoop:"⏹️", continueLoop:"⏭️", userInput:"💬", runWorkflow:"🧰",
  alertAccept:"✅", alertDismiss:"🚫", switchFrame:"🖼️", switchFrameDefault:"↩️",
};

/** Grouped, icon-labelled action picker used by the main editor and nested workflow widgets. */
export function ActionTypeSelect({ value, actions, translate, onChange, className = "text-input" }: Props) {
  return (
    <div className="select-wrap action-type-select">
      <select className={className} value={value} onChange={event => onChange(event.target.value as StepType)}>
        {actionGroups.map(group => {
          const groupActions = actions.filter(([type]) => group.types.includes(type));
          if (!groupActions.length) return null;
          return (
            <optgroup key={group.label} label={translate(group.label)}>
              {groupActions.map(([type, label]) => (
                <option value={type} key={type}>{actionEmoji[type] || "🔹"} {translate(label)}</option>
              ))}
            </optgroup>
          );
        })}
      </select>
      <ChevronDown size={14} />
    </div>
  );
}
