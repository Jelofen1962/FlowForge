import { useMemo } from "react";
import { Braces, Check, Download, FolderOpen, FolderPlus, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import { getActionIcon, getActionLabel } from "../data/actionCatalog";
import type { AppController } from "../state/useAppController";
import { Badge, Button, EmptyState, Icon, IconButton, Input, Kbd } from "../components";
import { Layers } from "lucide-react";

/** Left column: the workflow as a vertical pipeline. The connector line fills as steps succeed. */
export function StepsPanelBody({ app }: { app: AppController }) {
  const { t, steps, groups, selected, runState, stepSearch } = app;
  const rows = useMemo(() => {
    const needle = stepSearch.toLowerCase();
    return steps.map((step, index) => ({ step, index })).filter(({ step }) => `${step.name} ${step.type} ${step.target?.value || ""}`.toLowerCase().includes(needle));
  }, [steps, stepSearch]);

  return (
    <>
      <div className="steps-tools">
        <div className="input-group">
          <Icon icon={Search} size={14} />
          <Input sm aria-label={t("Search workflow steps")} value={stepSearch} onChange={event => app.setStepSearch(event.target.value)} placeholder={t("Find a step…")} />
          {stepSearch ? <IconButton size="sm" icon={X} label={t("Clear")} onClick={() => app.setStepSearch("")} style={{ position: "absolute", insetInlineEnd: 2, top: 0 }} /> : <Kbd>{steps.length}</Kbd>}
        </div>
        <div className="steps-meta">
          <Badge icon={Braces}>{t("SEQUENTIAL")}</Badge>
          <Button size="sm" variant="ghost" icon={FolderPlus} iconAnim="pop" onClick={app.addGroup}>{t("Group")}</Button>
        </div>
        {groups.map(group => (
          <div className="group-row" key={group.id}>
            <Input sm aria-label={t("Group name")} value={group.name} onChange={event => app.setGroups(all => all.map(x => (x.id === group.id ? { ...x, name: event.target.value } : x)))} />
            <IconButton size="sm" icon={Trash2} iconAnim="wiggle" label={t("Delete group and ungroup its steps")} onClick={() => {
              app.setGroups(all => all.filter(x => x.id !== group.id));
              app.setSteps(all => all.map(s => (s.groupId === group.id ? { ...s, groupId: undefined } : s)));
            }} />
          </div>
        ))}
      </div>

      {steps.length === 0 ? (
        <div style={{ padding: "0.75rem" }}>
          <EmptyState icon={Layers} title={t("No step selected")}>{t("Add a step to begin building your workflow.")}</EmptyState>
        </div>
      ) : (
        <ol className="step-list" aria-label={t("Workflow steps")}>
          {rows.map(({ step, index }) => {
            const status = runState[step.id];
            const groupName = step.groupId ? groups.find(g => g.id === step.groupId)?.name || t("Group") : "";
            return (
              <li key={step.id} className="step" data-status={status || undefined} data-selected={step.id === selected} data-disabled={step.disabled ? true : undefined}>
                <span className="step-rail">
                  <span className="step-node">
                    {status === "success" ? <Icon icon={Check} size={14} anim="draw" className="ico-draw-once" />
                      : status === "running" ? <Icon icon={LoaderCircle} size={14} spinning />
                      : status === "error" ? <Icon icon={X} size={14} />
                      : <Icon icon={getActionIcon(step.type)} size={14} />}
                  </span>
                </span>
                <button type="button" className="step-main" aria-current={step.id === selected ? "step" : undefined} onClick={() => app.setSelected(step.id)}>
                  <span className="step-name">{step.name || t("Untitled step")}</span>
                  <span className="step-sub">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <span>·</span>
                    <span>{t(getActionLabel(step.type))}</span>
                    {step.target?.value && <span>· {step.target.strategy}</span>}
                    {groupName && <span>· {groupName}</span>}
                  </span>
                </button>
                <span className="step-tools">
                  <IconButton size="sm" icon={Trash2} iconAnim="wiggle" label={`${t("Delete step")}: ${step.name}`} onClick={() => app.deleteStep(step.id)} />
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="steps-foot">
        <Button variant="dashed" icon={Plus} iconAnim="rotate" block onClick={() => app.addStep()}>{t("Add step")}</Button>
        <Button variant="dashed" icon={Braces} iconAnim="pop" block onClick={() => app.addStep("userInput")}>{t("Add user input step")}</Button>
        <div className="steps-foot-row">
          <Button size="sm" variant="ghost" icon={FolderOpen} iconAnim="pop" onClick={app.importWorkflow}>{t("Import")}</Button>
          <Button size="sm" variant="ghost" icon={Download} iconAnim="drop" onClick={app.exportWorkflow}>{t("Export")}</Button>
        </div>
      </div>
    </>
  );
}
