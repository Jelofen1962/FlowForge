use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStep {
    pub id: String,
    #[serde(rename = "type")]
    pub step_type: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub detail: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub continue_on_error: bool,
}
fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepResult {
    pub id: String,
    pub status: String,
    pub duration_ms: u128,
    pub message: Option<String>,
    pub value: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowResult {
    pub status: String,
    pub started_at_ms: u128,
    pub duration_ms: u128,
    pub steps: Vec<StepResult>,
}

pub fn validate_steps(steps: &[WorkflowStep]) -> Result<(), String> {
    let mut ids = std::collections::HashSet::new();
    for step in steps {
        if step.id.trim().is_empty() { return Err("Every workflow step requires an id.".into()); }
        if !ids.insert(&step.id) { return Err(format!("Duplicate workflow step id: {}", step.id)); }
        if step.step_type.trim().is_empty() { return Err(format!("Step {} requires a type.", step.id)); }
        if step.timeout_ms.is_some_and(|n| n == 0) { return Err(format!("Step {} timeout must be greater than zero.", step.id)); }
    }
    Ok(())
}

pub async fn execute_workflow<F, Fut>(
    steps: &[WorkflowStep],
    mut execute: F,
) -> Result<WorkflowResult, String>
where F: FnMut(WorkflowStep) -> Fut, Fut: std::future::Future<Output = Result<Value, String>> {
    validate_steps(steps)?;
    let started = Instant::now();
    let start_ms = now_ms();
    let mut results = Vec::new();
    let mut failed = false;
    for step in steps.iter().filter(|s| s.enabled) {
        let step_start = Instant::now();
        let outcome = execute(step.clone()).await;
        let duration_ms = step_start.elapsed().as_millis();
        match outcome {
            Ok(value) => results.push(StepResult { id: step.id.clone(), status: "passed".into(), duration_ms, message: None, value: Some(value) }),
            Err(error) => {
                failed = true;
                results.push(StepResult { id: step.id.clone(), status: "failed".into(), duration_ms, message: Some(error), value: None });
                if !step.continue_on_error { break; }
            }
        }
    }
    Ok(WorkflowResult { status: if failed { "failed" } else { "passed" }.into(), started_at_ms: start_ms, duration_ms: started.elapsed().as_millis(), steps: results })
}
fn now_ms() -> u128 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()
}

pub async fn execute_cdp_step(session: &crate::cdp::client::CdpSession, step: &WorkflowStep) -> Result<Value, String> {
    let detail = &step.detail;
    match step.step_type.as_str() {
        "navigate" => session.navigate(detail).await,
        "click" => {
            crate::cdp::executor::click_selector(session, detail, step.timeout_ms.unwrap_or(10_000)).await?;
            Ok(Value::Null)
        }
        "type" => {
            let (selector, text) = detail.split_once(" · ").ok_or("Type step detail must be 'selector · text'.")?;
            crate::cdp::executor::type_into_selector(session, selector, text, step.timeout_ms.unwrap_or(10_000)).await?;
            Ok(Value::Null)
        }
        "pressKey" => {
            session.press_key(detail).await?;
            Ok(Value::Null)
        }
        "wait" => {
            let element = crate::cdp::executor::wait_for_selector(session, detail, step.timeout_ms.unwrap_or(10_000)).await?;
            serde_json::to_value(element).map_err(|e| e.to_string())
        }
        "assertTextContains" => {
            let (selector, expected) = detail.split_once(" · ").ok_or("Assertion detail must be 'selector · expected text'.")?;
            let actual = session.evaluate(&format!("(() => {{ const e = document.querySelector({}); return e ? (e.innerText || e.value || '') : null; }})()", serde_json::to_string(selector.trim_start_matches("css:")).unwrap())).await?;
            let actual = actual.as_str().unwrap_or("");
            if actual.contains(expected) { Ok(Value::Bool(true)) } else { Err(format!("Expected text to contain {expected:?}; actual text was {actual:?}")) }
        }
        "assertUrl" => {
            let actual = session.evaluate("location.href").await?;
            if actual.as_str().is_some_and(|s| s.contains(detail)) { Ok(Value::Bool(true)) }
            else { Err(format!("Current URL did not contain {detail:?}")) }
        }
        "reload" => session.call("Page.reload", serde_json::json!({"ignoreCache":false})).await,
        "back" => session.evaluate("history.back()").await,
        "forward" => session.evaluate("history.forward()").await,
        "scrollTo" => {
            let y: i64 = detail.parse().map_err(|_| "scrollTo detail must be a y coordinate.")?;
            session.evaluate(&format!("window.scrollTo({{top:{y},behavior:'instant'}}); true")).await
        }
        "evaluate" => session.evaluate(detail).await,
        other => Err(format!("Unsupported workflow step type: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_ids_and_timeouts() {
        let step = WorkflowStep { id: "a".into(), step_type: "navigate".into(), title: "".into(), detail: "".into(), enabled: true, timeout_ms: Some(0), continue_on_error: false };
        assert!(validate_steps(&[step]).is_err());
    }
    #[test]
    fn rejects_duplicate_ids() {
        let mk = |id: &str| WorkflowStep { id:id.into(), step_type:"wait".into(), title:"".into(), detail:"#x".into(), enabled:true, timeout_ms:None, continue_on_error:false };
        assert!(validate_steps(&[mk("same"), mk("same")]).is_err());
    }
}
