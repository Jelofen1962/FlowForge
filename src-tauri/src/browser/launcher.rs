use std::{net::TcpListener, path::{Path, PathBuf}, process::{Child, Command, Stdio}, time::Duration};
use url::Url;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct BrowserLaunchOptions {
    pub url: String,
    pub headless: bool,
    pub profile_id: String,
    pub engine: String,
    pub devtools_port: u16,
    pub executable_override: Option<PathBuf>,
}

pub struct BrowserInstance {
    pub id: String,
    pub engine: String,
    pub child: Child,
    pub port: u16,
    pub profile_path: PathBuf,
    pub executable: PathBuf,
    pub started_at_ms: u128,
}

pub fn validate_navigation_url(raw: &str) -> Result<Url, String> {
    let parsed = Url::parse(raw).map_err(|e| format!("Invalid URL: {e}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only HTTP and HTTPS navigation URLs are allowed.".into());
    }
    if parsed.host_str().is_none() {
        return Err("Navigation URL must include a host.".into());
    }
    Ok(parsed)
}

pub fn validate_profile_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 80 ||
        !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("Profile ID must be 1-80 characters and contain only letters, numbers, '-' or '_'.".into());
    }
    Ok(())
}

pub fn find_available_port(start_port: u16) -> Result<u16, String> {
    for port in start_port.max(1024)..=u16::MAX {
        if let Ok(listener) = TcpListener::bind(("127.0.0.1", port)) {
            drop(listener);
            return Ok(port);
        }
    }
    Err("No available loopback debugging port found.".into())
}

fn profile_root() -> PathBuf {
    #[cfg(windows)]
    {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir).join("Cobweb").join("Profiles")
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("XDG_DATA_HOME").map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local").join("share")))
            .unwrap_or_else(std::env::temp_dir).join("Cobweb").join("Profiles")
    }
}

pub fn profile_path_for(id: &str) -> Result<PathBuf, String> {
    validate_profile_id(id)?;
    Ok(profile_root().join(id))
}

pub fn launch_browser(opts: &BrowserLaunchOptions) -> Result<BrowserInstance, String> {
    let url = validate_navigation_url(&opts.url)?;
    validate_profile_id(&opts.profile_id)?;
    if !matches!(opts.engine.to_ascii_lowercase().as_str(), "edge" | "chrome" | "chromium") {
        return Err(format!("Unsupported browser engine: {}", opts.engine));
    }
    let executable = match &opts.executable_override {
        Some(p) if p.is_file() => p.clone(),
        Some(p) => return Err(format!("Browser executable does not exist: {}", p.display())),
        None => super::discovery::find_browser_executable(&opts.engine)?,
    };
    let port = find_available_port(opts.devtools_port.max(9222))?;
    let profile_path = profile_path_for(&opts.profile_id)?;
    std::fs::create_dir_all(&profile_path).map_err(|e| format!("Could not create profile directory: {e}"))?;
    let mut command = Command::new(&executable);
    command
        .arg(format!("--remote-debugging-port={port}"))
        .arg("--remote-debugging-address=127.0.0.1")
        .arg(format!("--user-data-dir={}", profile_path.to_string_lossy()))
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--disable-background-networking")
        .arg(url.as_str())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if opts.headless {
        command.arg("--headless=new").arg("--disable-gpu");
    }
    let child = command.spawn().map_err(|e| format!("Failed to launch browser: {e}"))?;
    Ok(BrowserInstance {
        id: Uuid::new_v4().to_string(),
        engine: opts.engine.to_ascii_lowercase(),
        child,
        port,
        profile_path,
        executable,
        started_at_ms: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .unwrap_or(Duration::ZERO).as_millis(),
    })
}

#[allow(dead_code)]
fn _path_is_under_root(path: &Path, root: &Path) -> bool { path.starts_with(root) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn allows_only_http_schemes() {
        assert!(validate_navigation_url("https://example.com").is_ok());
        assert!(validate_navigation_url("http://127.0.0.1:3000").is_ok());
        assert!(validate_navigation_url("file:///etc/passwd").is_err());
        assert!(validate_navigation_url("javascript:alert(1)").is_err());
    }
    #[test]
    fn profile_id_blocks_path_traversal() {
        assert!(validate_profile_id("profile_01").is_ok());
        assert!(validate_profile_id("../outside").is_err());
        assert!(validate_profile_id("a/b").is_err());
        assert!(validate_profile_id("").is_err());
    }
    #[test]
    fn port_starts_at_requested_port_or_higher() {
        let p = find_available_port(9222).unwrap();
        assert!(p >= 9222);
    }
}
