export type StepKind = "navigate" | "click" | "type" | "wait" | "extract";

export type WorkflowStep = {
  id: string;
  kind: StepKind;
  title: string;
  description: string;
  value: string;
  enabled: boolean;
};

export type Workflow = {
  id: string;
  name: string;
  steps: WorkflowStep[];
};

export const stepLabels: Record<StepKind, string> = {
  navigate: "Navigate to URL",
  click: "Click element",
  type: "Type text",
  wait: "Wait",
  extract: "Extract data"
};
