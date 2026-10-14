pub mod browser;
pub mod cdp;
pub mod commands;
pub mod data_engine;
pub mod workflow;
pub mod runner;

use std::sync::Arc;
use tokio::sync::Mutex;
use browser::process::BrowserManager;
use cdp::client::CdpRegistry;

pub struct AppState {
    pub browsers: Arc<Mutex<BrowserManager>>,
    pub cdp: Arc<CdpRegistry>,
}


impl Default for AppState {
    fn default() -> Self {
        Self {
            browsers: Arc::new(Mutex::new(BrowserManager::default())),
            cdp: Arc::new(CdpRegistry::default()),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::discover_browsers,
            commands::launch_browser,
            commands::close_browser,
            commands::list_browser_sessions,
            commands::connect_cdp,
            commands::cdp_navigate,
            commands::cdp_evaluate,
            commands::cdp_click,
            commands::cdp_type_text,
            commands::cdp_press_key,
            commands::cdp_find_element,
            commands::cdp_wait_for_selector,
            commands::inspect_data,
            commands::filter_data,
            commands::execute_workflow,
            commands::run_external_script
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Cobweb application");
}
