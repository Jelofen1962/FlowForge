use serde::{Deserialize, Serialize};
use std::{path::PathBuf, process::Stdio, time::Duration};
use tokio::{io::AsyncReadExt, process::Command};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunnerRequest {
    pub executable: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub working_directory: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunnerResult {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
}

pub async fn run_external(request: RunnerRequest) -> Result<RunnerResult, String> {
    if request.executable.trim().is_empty() { return Err("Runner executable is required.".into()); }
    let executable = PathBuf::from(&request.executable);
    if executable.components().count() > 1 && !executable.is_file() {
        return Err(format!("Runner executable does not exist: {}", executable.display()));
    }
    let timeout = Duration::from_millis(request.timeout_ms.unwrap_or(60_000).clamp(100, 600_000));
    let mut command = Command::new(&request.executable);
    command.args(&request.args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true);
    if let Some(dir) = request.working_directory { command.current_dir(dir); }
    let mut child = command.spawn().map_err(|e| format!("Failed to start runner: {e}"))?;
    let result = tokio::time::timeout(timeout, async {
        let output = child.wait_with_output().await.map_err(|e| format!("Runner failed: {e}"))?;
        Ok::<_, String>(RunnerResult {
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).chars().take(1_000_000).collect(),
            stderr: String::from_utf8_lossy(&output.stderr).chars().take(1_000_000).collect(),
            timed_out: false,
        })
    }).await;
    match result {
        Ok(output) => output,
        Err(_) => Ok(RunnerResult { exit_code: None, stdout: String::new(), stderr: "Runner timed out and was terminated.".into(), timed_out: true }),
    }
}
