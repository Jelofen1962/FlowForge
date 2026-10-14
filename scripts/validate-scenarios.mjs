import fs from "node:fs";
import YAML from "yaml";

const path = "tests/scenarios.yaml";
const document = YAML.parse(fs.readFileSync(path, "utf8"));

if (!document || typeof document !== "object") {
  throw new Error(`${path} must contain a YAML mapping.`);
}
if (!Array.isArray(document.scenarios) || document.scenarios.length === 0) {
  throw new Error(`${path} must define a non-empty scenarios array.`);
}

const ids = new Set();
for (const [index, scenario] of document.scenarios.entries()) {
  const label = `scenario at index ${index}`;
  if (!scenario || typeof scenario !== "object") {
    throw new Error(`${label} must be a mapping.`);
  }
  if (typeof scenario.id !== "string" || !scenario.id.trim()) {
    throw new Error(`${label} is missing a string id.`);
  }
  if (ids.has(scenario.id)) {
    throw new Error(`Duplicate scenario id: ${scenario.id}`);
  }
  ids.add(scenario.id);
  if (typeof scenario.name !== "string" || !scenario.name.trim()) {
    throw new Error(`${scenario.id} is missing a name.`);
  }
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
    throw new Error(`${scenario.id} must contain at least one step.`);
  }
}

console.log(`Validated ${document.scenarios.length} scenarios from ${path}.`);
