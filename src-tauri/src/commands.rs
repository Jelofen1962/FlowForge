use crate::{
    browser::{discovery, launcher::BrowserLaunchOptions, process::BrowserSessionInfo},
    cdp::{client::CdpSession, executor},
    data_engine,
    runner::{self, RunnerRequest},
    workflow::{self, WorkflowStep},
    AppState,
};
use serde_json::Value;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub fn discover_browsers() -> Vec<discovery::BrowserCandidate> { discovery::discover_browsers() }

#[tauri::command]
pub async fn launch_browser(
    url: String, headless: Option<bool>, profile_id: String, browser_engine: String,
    devtools_port: Option<u16>, executable_path: Option<String>, state: State<'_, AppState>,
) -> Result<BrowserSessionInfo, String> {
    let opts = BrowserLaunchOptions {
        url, headless: headless.unwrap_or(false), profile_id, engine: browser_engine,
        devtools_port: devtools_port.unwrap_or(9222),
        executable_override: executable_path.map(PathBuf::from),
    };
    state.browsers.lock().await.launch(&opts)
}

#[tauri::command]
pub async fn close_browser(browser_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.cdp.remove(&browser_id).await;
    state.browsers.lock().await.close(&browser_id)
}

#[tauri::command]
pub async fn list_browser_sessions(state: State<'_, AppState>) -> Result<Vec<BrowserSessionInfo>, String> {
    Ok(state.browsers.lock().await.list())
}

#[tauri::command]
pub async fn connect_cdp(browser_id: String, port: u16, state: State<'_, AppState>) -> Result<String, String> {
    let session = CdpSession::from_port(port).await?;
    session.call("Page.enable", serde_json::json!({})).await?;
    session.call("Runtime.enable", serde_json::json!({})).await?;
    state.cdp.insert(browser_id, session).await;
    Ok("Connected to local browser DevTools.".into())
}

#[tauri::command]
pub async fn cdp_navigate(browser_id: String, url: String, state: State<'_, AppState>) -> Result<Value, String> {
    state.cdp.get(&browser_id).await?.navigate(&url).await
}
#[tauri::command]
pub async fn cdp_evaluate(browser_id: String, expression: String, state: State<'_, AppState>) -> Result<Value, String> {
    state.cdp.get(&browser_id).await?.evaluate(&expression).await
}
#[tauri::command]
pub async fn cdp_click(browser_id: String, selector: String, timeout_ms: Option<u64>, state: State<'_, AppState>) -> Result<(), String> {
    executor::click_selector(&state.cdp.get(&browser_id).await?, &selector, timeout_ms.unwrap_or(10_000)).await
}
#[tauri::command]
pub async fn cdp_type_text(browser_id: String, selector: String, text: String, timeout_ms: Option<u64>, state: State<'_, AppState>) -> Result<(), String> {
    executor::type_into_selector(&state.cdp.get(&browser_id).await?, &selector, &text, timeout_ms.unwrap_or(10_000)).await
}
#[tauri::command]
pub async fn cdp_press_key(browser_id: String, key: String, state: State<'_, AppState>) -> Result<(), String> {
    state.cdp.get(&browser_id).await?.press_key(&key).await
}
#[tauri::command]
pub async fn cdp_find_element(browser_id: String, selector: String, state: State<'_, AppState>) -> Result<Option<crate::cdp::protocol::ElementMatch>, String> {
    executor::find_element(&state.cdp.get(&browser_id).await?, &selector).await
}
#[tauri::command]
pub async fn cdp_wait_for_selector(browser_id: String, selector: String, timeout_ms: Option<u64>, state: State<'_, AppState>) -> Result<crate::cdp::protocol::ElementMatch, String> {
    executor::wait_for_selector(&state.cdp.get(&browser_id).await?, &selector, timeout_ms.unwrap_or(10_000)).await
}

#[tauri::command]
pub fn inspect_data(input: String) -> Result<(Vec<Value>, data_engine::DataSummary), String> {
    let rows = data_engine::parse_records(&input)?;
    let summary = data_engine::summarize(&rows);
    Ok((rows, summary))
}
#[tauri::command]
pub fn filter_data(input: String, field: String, operator: String, operand: Value) -> Result<Vec<Value>, String> {
    let rows = data_engine::parse_records(&input)?;
    data_engine::filter_records(&rows, &field, &operator, &operand)
}

#[tauri::command]
pub async fn execute_workflow(browser_id: String, steps: Vec<WorkflowStep>, state: State<'_, AppState>) -> Result<workflow::WorkflowResult, String> {
    let session = state.cdp.get(&browser_id).await?;
    workflow::execute_workflow(&steps, move |step| {
        let session = session.clone();
        async move {
            if !step.enabled { return Ok(Value::Null); }
            workflow::execute_cdp_step(&session, &step).await
        }
    }).await
}

#[tauri::command]
pub async fn run_external_script(request: RunnerRequest) -> Result<runner::RunnerResult, String> {
    runner::run_external(request).await
}
