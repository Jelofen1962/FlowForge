import type { Dispatch, SetStateAction } from "react";
import { CalendarClock, Info } from "lucide-react";
import { Hint, Icon, Input, Select, SwitchRow } from "../components";

type ScheduleUnit = "seconds" | "minutes" | "hours" | "days";
type Props = {
  enabled: boolean;
  setEnabled: Dispatch<SetStateAction<boolean>>;
  every: number;
  setEvery: Dispatch<SetStateAction<number>>;
  unit: string;
  setUnit: Dispatch<SetStateAction<string>>;
  startup: boolean;
  onStartupChange: (enabled: boolean) => void | Promise<void>;
  t?: (text: string) => string;
};

/** Scheduler preferences: a self-contained settings widget, independent of app composition. */
export function ScheduleSettings({ enabled, setEnabled, every, setEvery, unit, setUnit, startup, onStartupChange, t = text => text }: Props) {
  return (
    <section aria-labelledby="schedule-settings-title">
      <div className="card-title" id="schedule-settings-title" style={{ marginBottom: 8 }}><Icon icon={CalendarClock} size={16} />{t("AUTOMATIC JOBS")}</div>
      <Hint icon={<Icon icon={Info} size={13} />}>{t("Schedule the currently open workflow. Repeat timers run while FlowForge is open. Windows startup launches the app at sign-in and triggers one run.")}</Hint>
      <SwitchRow label={t("Repeat automatically")} description={t("Run the current workflow on a repeating timer")} checked={enabled} onChange={setEnabled} />
      <div className="schedule-row">
        <Input aria-label={t("Repeat interval")} type="number" min="1" max="100000" value={every} onChange={event => setEvery(Math.max(1, Number(event.target.value) || 1))} />
        <Select aria-label={t("Repeat interval unit")} value={unit} onChange={event => setUnit(event.target.value as ScheduleUnit)}>
          <option value="seconds">{t("Every seconds")}</option>
          <option value="minutes">{t("Every minutes")}</option>
          <option value="hours">{t("Every hours")}</option>
          <option value="days">{t("Every days")}</option>
        </Select>
      </div>
      <SwitchRow label={t("Run at Windows startup")} description={t("Launch FlowForge at sign-in and run once using the currently saved workflow")} checked={startup} onChange={value => void onStartupChange(value)} />
    </section>
  );
}
