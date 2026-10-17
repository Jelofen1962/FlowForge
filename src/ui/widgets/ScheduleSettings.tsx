import type { Dispatch, SetStateAction } from "react";

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
};

/** Scheduler preferences are a self-contained settings widget, independent of app composition. */
export function ScheduleSettings({ enabled, setEnabled, every, setEvery, unit, setUnit, startup, onStartupChange }: Props) {
  return <section className="schedule-settings" aria-labelledby="schedule-settings-title">
    <div className="section-caption schedule-section-title" id="schedule-settings-title">AUTOMATIC JOBS</div>
    <p className="hint">Schedule the currently open workflow. Repeat timers run while FlowForge is open. Windows startup launches the app at sign-in and triggers one run.</p>
    <label className="setting-row"><span><strong>Repeat automatically</strong><small>Run the current workflow on a repeating timer</small></span><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/></label>
    <div className="schedule-controls">
      <input className="text-input" aria-label="Repeat interval" type="number" min="1" max="100000" value={every} onChange={event=>setEvery(Math.max(1,Number(event.target.value)||1))}/>
      <select className="text-input" aria-label="Repeat interval unit" value={unit} onChange={event=>setUnit(event.target.value as ScheduleUnit)}>
        <option value="seconds">Every seconds</option><option value="minutes">Every minutes</option><option value="hours">Every hours</option><option value="days">Every days</option>
      </select>
    </div>
    <label className="setting-row"><span><strong>Run at Windows startup</strong><small>Launch FlowForge at sign-in and run once using the currently saved workflow</small></span><input type="checkbox" checked={startup} onChange={event=>void onStartupChange(event.target.checked)}/></label>
  </section>;
}
