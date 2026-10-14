use super::launcher::{launch_browser, BrowserInstance, BrowserLaunchOptions};
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSessionInfo {
    pub id: String,
    pub engine: String,
    pub port: u16,
    pub profile_path: String,
    pub executable: String,
    pub pid: Option<u32>,
    pub running: bool,
    pub started_at_ms: u128,
}

#[derive(Default)]
pub struct BrowserManager {
    sessions: HashMap<String, BrowserInstance>,
}

impl BrowserManager {
    pub fn launch(&mut self, options: &BrowserLaunchOptions) -> Result<BrowserSessionInfo, String> {
        let mut instance = launch_browser(options)?;
        let info = session_info(&mut instance);
        self.sessions.insert(info.id.clone(), instance);
        Ok(info)
    }

    pub fn list(&mut self) -> Vec<BrowserSessionInfo> {
        self.sessions.retain(|_, instance| {
            match instance.child.try_wait() {
                Ok(Some(_)) => false,
                Ok(None) => true,
                Err(_) => false,
            }
        });
        self.sessions.values_mut().map(session_info).collect()
    }

    pub fn close(&mut self, id: &str) -> Result<bool, String> {
        let Some(mut instance) = self.sessions.remove(id) else { return Ok(false); };
        match instance.child.try_wait() {
            Ok(Some(_)) => Ok(true),
            Ok(None) => {
                instance.child.kill().map_err(|e| format!("Failed to stop browser: {e}"))?;
                let _ = instance.child.wait();
                Ok(true)
            }
            Err(e) => Err(format!("Could not inspect browser process: {e}")),
        }
    }

    pub fn close_all(&mut self) {
        for (_, mut instance) in self.sessions.drain() {
            if instance.child.try_wait().ok().flatten().is_none() {
                let _ = instance.child.kill();
                let _ = instance.child.wait();
            }
        }
    }
}

impl Drop for BrowserManager {
    fn drop(&mut self) { self.close_all(); }
}

fn session_info(instance: &mut BrowserInstance) -> BrowserSessionInfo {
    let running = match instance.child.try_wait() {
        Ok(Some(_)) => false,
        Ok(None) => true,
        Err(_) => false,
    };
    BrowserSessionInfo {
        id: instance.id.clone(),
        engine: instance.engine.clone(),
        port: instance.port,
        profile_path: instance.profile_path.to_string_lossy().into_owned(),
        executable: instance.executable.to_string_lossy().into_owned(),
        pid: Some(instance.child.id()),
        running,
        started_at_ms: instance.started_at_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn empty_manager_lists_no_sessions() {
        let mut manager = BrowserManager::default();
        assert!(manager.list().is_empty());
        assert_eq!(manager.close("missing").unwrap(), false);
    }
}
