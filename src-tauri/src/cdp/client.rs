use super::protocol::{CdpRequest, CdpResponse};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::{collections::HashMap, sync::{Arc, atomic::{AtomicU64, Ordering}}};
use tokio::{net::TcpStream, sync::{Mutex, oneshot}};
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};
use url::Url;

type WsSink = futures_util::stream::SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>;
type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>;

#[derive(Clone)]
pub struct CdpSession {
    next_id: Arc<AtomicU64>,
    sender: Arc<Mutex<WsSink>>,
    pending: Pending,
}

impl CdpSession {
    pub async fn connect(ws_url: &str) -> Result<Self, String> {
        let parsed = Url::parse(ws_url).map_err(|e| format!("Invalid CDP WebSocket URL: {e}"))?;
        if !matches!(parsed.scheme(), "ws" | "wss") ||
           !matches!(parsed.host_str(), Some("127.0.0.1" | "localhost" | "::1")) {
            return Err("CDP WebSocket must use a loopback host.".into());
        }
        let (stream, _) = connect_async(ws_url).await.map_err(|e| format!("CDP WebSocket connection failed: {e}"))?;
        let (sender, mut receiver) = stream.split();
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));
        let pending_rx = pending.clone();
        tokio::spawn(async move {
            while let Some(message) = receiver.next().await {
                let Ok(message) = message else { break; };
                let text = match message {
                    Message::Text(s) => s.to_string(),
                    Message::Close(_) => break,
                    _ => continue,
                };
                let Ok(response) = serde_json::from_str::<CdpResponse>(&text) else { continue; };
                if let Some(id) = response.id {
                    if let Some(tx) = pending_rx.lock().await.remove(&id) {
                        let result = match response.error {
                            Some(e) => Err(format!("CDP error {}: {}", e.code, e.message)),
                            None => Ok(response.result.unwrap_or(Value::Null)),
                        };
                        let _ = tx.send(result);
                    }
                }
            }
            for (_, tx) in pending_rx.lock().await.drain() {
                let _ = tx.send(Err("CDP WebSocket closed before response arrived.".into()));
            }
        });
        Ok(Self {
            next_id: Arc::new(AtomicU64::new(1)),
            sender: Arc::new(Mutex::new(sender)),
            pending,
        })
    }

    pub async fn from_port(port: u16) -> Result<Self, String> {
        let endpoint = format!("http://127.0.0.1:{port}/json/version");
        // Connect to a page target, not the browser-level websocket. Page/Runtime/Input
        // commands are target-scoped and generally fail on the browser-level endpoint.
        let targets_url = format!("http://127.0.0.1:{port}/json/list");
        let targets: Vec<Value> = reqwest::Client::new().get(&targets_url)
            .timeout(std::time::Duration::from_secs(3)).send().await
            .map_err(|e| format!("Could not query DevTools targets: {e}"))?
            .error_for_status().map_err(|e| format!("DevTools targets endpoint returned an error: {e}"))?
            .json().await.map_err(|e| format!("Invalid DevTools targets response: {e}"))?;
        let ws_url = targets.iter()
            .find(|target| target.get("type").and_then(Value::as_str) == Some("page"))
            .and_then(|target| target.get("webSocketDebuggerUrl"))
            .and_then(Value::as_str)
            .ok_or("No page target is available at this DevTools port.")?;
        Self::connect(ws_url).await
    }

    pub async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);
        let request = CdpRequest { id, method, params: Some(params) };
        let serialized = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        if let Err(e) = self.sender.lock().await.send(Message::Text(serialized.into())).await {
            self.pending.lock().await.remove(&id);
            return Err(format!("Failed to send CDP command: {e}"));
        }
        tokio::time::timeout(std::time::Duration::from_secs(20), rx).await
            .map_err(|_| {
                // The pending entry is removed by the receiver if a late response arrives.
                format!("Timed out waiting for CDP method {method}.")
            })?
            .map_err(|_| "CDP response channel was closed.".to_string())?
    }

    pub async fn navigate(&self, url: &str) -> Result<Value, String> {
        super::super::browser::launcher::validate_navigation_url(url)?;
        self.call("Page.enable", json!({})).await?;
        self.call("Page.navigate", json!({"url": url})).await
    }

    pub async fn evaluate(&self, expression: &str) -> Result<Value, String> {
        let result = self.call("Runtime.evaluate", json!({
            "expression": expression,
            "returnByValue": true,
            "awaitPromise": true,
            "userGesture": true
        })).await?;
        if let Some(exception) = result.get("exceptionDetails") {
            return Err(format!("JavaScript evaluation failed: {exception}"));
        }
        Ok(result.get("result").and_then(|v| v.get("value"))
            .cloned().unwrap_or(result))
    }

    pub async fn click_at(&self, x: f64, y: f64) -> Result<(), String> {
        if !x.is_finite() || !y.is_finite() || x < 0.0 || y < 0.0 {
            return Err("Click coordinates must be finite non-negative numbers.".into());
        }
        self.call("Input.dispatchMouseEvent", json!({"type":"mouseMoved","x":x,"y":y})).await?;
        self.call("Input.dispatchMouseEvent", json!({"type":"mousePressed","button":"left","clickCount":1,"x":x,"y":y})).await?;
        self.call("Input.dispatchMouseEvent", json!({"type":"mouseReleased","button":"left","clickCount":1,"x":x,"y":y})).await?;
        Ok(())
    }

    pub async fn insert_text(&self, text: &str) -> Result<(), String> {
        self.call("Input.insertText", json!({"text":text})).await?;
        Ok(())
    }

    pub async fn press_key(&self, key: &str) -> Result<(), String> {
        let allowed = ["Enter", "Tab", "Escape", "Backspace", "Delete", "ArrowUp", "ArrowDown",
            "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", "Space"];
        if !allowed.contains(&key) && !(key.len() == 1 && key.is_ascii()) {
            return Err("Unsupported key. Use a single ASCII character or a supported named key.".into());
        }
        self.call("Input.dispatchKeyEvent", json!({"type":"keyDown","key":key})).await?;
        self.call("Input.dispatchKeyEvent", json!({"type":"keyUp","key":key})).await?;
        Ok(())
    }
}

#[derive(Default)]
pub struct CdpRegistry {
    sessions: Mutex<HashMap<String, CdpSession>>,
}
impl CdpRegistry {
    pub async fn insert(&self, id: String, session: CdpSession) {
        self.sessions.lock().await.insert(id, session);
    }
    pub async fn get(&self, id: &str) -> Result<CdpSession, String> {
        self.sessions.lock().await.get(id).cloned().ok_or_else(|| format!("No CDP session for browser id {id}. Connect first."))
    }
    pub async fn remove(&self, id: &str) {
        self.sessions.lock().await.remove(id);
    }
}
