use serde::Serialize;
use std::{env, path::PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserCandidate {
    pub engine: String,
    pub executable: String,
    pub exists: bool,
}

pub fn candidate_paths(engine: &str) -> Vec<PathBuf> {
    let local = env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_default();
    let pf = env::var_os("ProgramFiles").map(PathBuf::from).unwrap_or_default();
    let pf86 = env::var_os("ProgramFiles(x86)").map(PathBuf::from).unwrap_or_default();
    let mut paths = match engine.to_ascii_lowercase().as_str() {
        "edge" => vec![
            pf86.join(r"Microsoft\Edge\Application\msedge.exe"),
            pf.join(r"Microsoft\Edge\Application\msedge.exe"),
            local.join(r"Microsoft\Edge\Application\msedge.exe"),
        ],
        "chrome" => vec![
            pf.join(r"Google\Chrome\Application\chrome.exe"),
            pf86.join(r"Google\Chrome\Application\chrome.exe"),
            local.join(r"Google\Chrome\Application\chrome.exe"),
        ],
        "chromium" => vec![
            local.join(r"Chromium\Application\chrome.exe"),
            pf.join(r"Chromium\Application\chrome.exe"),
            pf86.join(r"Chromium\Application\chrome.exe"),
        ],
        _ => vec![],
    };
    if let Some(extra) = env::var_os("COBWEB_BROWSER_PATH") {
        paths.insert(0, PathBuf::from(extra));
    }
    paths
}

pub fn find_browser_executable(engine: &str) -> Result<PathBuf, String> {
    if !matches!(engine.to_ascii_lowercase().as_str(), "edge" | "chrome" | "chromium") {
        return Err(format!("Unsupported browser engine: {engine}"));
    }
    candidate_paths(engine).into_iter().find(|p| p.is_file())
        .ok_or_else(|| format!("Could not locate {engine}. Set COBWEB_BROWSER_PATH or choose a browser installed on this machine."))
}

pub fn discover_browsers() -> Vec<BrowserCandidate> {
    ["edge", "chrome", "chromium"].iter().flat_map(|engine| {
        candidate_paths(engine).into_iter().filter(|p| p.is_file()).take(1).map(|p| BrowserCandidate {
            engine: (*engine).to_string(),
            executable: p.to_string_lossy().into_owned(),
            exists: true,
        }).collect::<Vec<_>>()
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unknown_engine() {
        assert!(find_browser_executable("firefox").is_err());
    }
    #[test]
    fn known_engines_are_case_insensitive() {
        assert!(candidate_paths("EDGE").len() >= 1);
        assert!(candidate_paths("Chrome").len() >= 1);
        assert!(candidate_paths("chromium").len() >= 1);
    }
}
