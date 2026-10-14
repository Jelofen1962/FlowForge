use serde::Serialize;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::net::TcpListener;
use url::Url;
use regex::Regex;
use tauri::State;

#[derive(Default)]
struct BrowserState { children: Mutex<Vec<Child>> }

impl Drop for BrowserState {
    fn drop(&mut self) {
        if let Ok(children) = self.children.get_mut() {
            for child in children.iter_mut() { let _ = child.kill(); let _ = child.wait(); }
        }
    }
}

fn choose_devtools_port(requested: u16) -> Result<u16, String> {
    if !(1024..=65535).contains(&requested) { return Err("DevTools port must be between 1024 and 65535".into()); }
    for candidate in std::iter::once(requested).chain((requested.saturating_add(1)..=u16::MAX).chain(1024..requested)) {
        if let Ok(listener) = TcpListener::bind(("127.0.0.1", candidate)) {
            drop(listener);
            return Ok(candidate);
        }
    }
    Err("No available local DevTools port was found.".into())
}

#[derive(Serialize)]
struct BrowserLaunch { launched: bool, message: String }

// Starter implementation: opens a dedicated Chromium/Chrome process. The next integration layer
// should attach to its DevTools Protocol endpoint for DOM selection and automation commands.
#[tauri::command]
fn launch_browser(url: String, headless: bool, profile_id: Option<String>, browser_engine: Option<String>, devtools_port: Option<u16>, state: State<BrowserState>) -> Result<BrowserLaunch, String> {
    validate_http_url(&url)?;
    let raw_profile = profile_id.unwrap_or_else(|| "default".to_string());
    let safe_profile: String = raw_profile.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').take(64).collect();
    let safe_profile = if safe_profile.is_empty() { "default".to_string() } else { safe_profile };
    let profile_dir = std::env::current_dir().map_err(|e| e.to_string())?.join(".cobweb").join("browser-profiles").join(&safe_profile);
    std::fs::create_dir_all(&profile_dir).map_err(|e| format!("Could not create browser profile directory: {e}"))?;
    let profile_path = profile_dir.to_string_lossy().to_string();
    let engine = browser_engine.unwrap_or_else(|| "edge".to_string()).to_ascii_lowercase();
    let port = choose_devtools_port(devtools_port.unwrap_or(9222))?;
    let candidates: Vec<String> = if cfg!(target_os = "windows") {
        let mut paths = Vec::new();
        let edge_names = [
            std::env::var("ProgramFiles(x86)").ok().map(|p| format!(r"{p}\Microsoft\Edge\Application\msedge.exe")),
            std::env::var("ProgramFiles").ok().map(|p| format!(r"{p}\Microsoft\Edge\Application\msedge.exe")),
            std::env::var("LOCALAPPDATA").ok().map(|p| format!(r"{p}\Microsoft\Edge\Application\msedge.exe")),
        ];
        let chromium_names = [
            std::env::var("LOCALAPPDATA").ok().map(|p| format!(r"{p}\Chromium\Application\chrome.exe")),
            std::env::var("ProgramFiles").ok().map(|p| format!(r"{p}\Chromium\Application\chrome.exe")),
        ];
        let chrome_names = [
            std::env::var("ProgramFiles").ok().map(|p| format!(r"{p}\Google\Chrome\Application\chrome.exe")),
            std::env::var("ProgramFiles(x86)").ok().map(|p| format!(r"{p}\Google\Chrome\Application\chrome.exe")),
            std::env::var("LOCALAPPDATA").ok().map(|p| format!(r"{p}\Google\Chrome\Application\chrome.exe")),
        ];
        let add_existing = |target: &mut Vec<String>, items: &[Option<String>]| {
            for item in items.iter().flatten() { if std::path::Path::new(item).is_file() { target.push(item.clone()); } }
        };
        match engine.as_str() {
            "edge" => { add_existing(&mut paths, &edge_names); paths.push("msedge".into()); paths.push("microsoft-edge".into()); }
            "chrome" => { add_existing(&mut paths, &chrome_names); paths.push("chrome".into()); }
            "chromium" => { add_existing(&mut paths, &chromium_names); paths.push("chromium".into()); paths.push("chromium-browser".into()); }
            _ => return Err(format!("Unsupported browser engine '{engine}'. Choose edge, chrome, or chromium.")),
        }
        paths
    } else if cfg!(target_os = "macos") {
        match engine.as_str() {
            "edge" => vec!["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge".into(), "microsoft-edge".into()],
            "chrome" => vec!["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into(), "google-chrome".into()],
            "chromium" => vec!["chromium".into(), "chromium-browser".into()],
            _ => return Err(format!("Unsupported browser engine '{engine}'.")),
        }
    } else {
        match engine.as_str() {
            "edge" => vec!["microsoft-edge".into(), "microsoft-edge-stable".into(), "msedge".into()],
            "chrome" => vec!["google-chrome".into(), "google-chrome-stable".into()],
            "chromium" => vec!["chromium".into(), "chromium-browser".into()],
            _ => return Err(format!("Unsupported browser engine '{engine}'.")),
        }
    };
    let mut last_error = String::from("No supported Chromium browser found in PATH or standard location.");
    for bin in candidates {
        let mut cmd = Command::new(&bin);
        cmd.arg("--remote-debugging-address=127.0.0.1").arg(format!("--remote-debugging-port={port}")).arg(format!("--user-data-dir={profile_path}"));
        if headless { cmd.arg("--headless=new"); }
        cmd.arg(format!("--disk-cache-dir={}", profile_dir.join("http-cache").to_string_lossy()));
        cmd.arg("--disable-background-networking").arg(url.clone()).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
        match cmd.spawn() {
            Ok(child) => {
                let mut guard = state.children.lock().map_err(|_| "Browser state lock failed".to_string())?;
                guard.retain_mut(|existing| match existing.try_wait() { Ok(Some(_)) => false, _ => true });
                guard.push(child);
                return Ok(BrowserLaunch { launched: true, message: format!("Started {bin} with profile '{safe_profile}' and DevTools on port {port}.") });
            },
            Err(e) => last_error = format!("Could not launch {bin}: {e}"),
        }
    }
    Err(last_error)
}

#[tauri::command]
fn browser_status(state: State<BrowserState>) -> Result<bool, String> {
    let mut guard = state.children.lock().map_err(|_| "Browser state lock failed".to_string())?;
    let mut first_error = None;
    guard.retain_mut(|child| match child.try_wait() {
        Ok(Some(_)) => false,
        Ok(None) => true,
        Err(error) => { first_error = Some(error.to_string()); true }
    });
    if let Some(error) = first_error { return Err(error); }
    Ok(!guard.is_empty())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BrowserState::default())
        .invoke_handler(tauri::generate_handler![launch_browser, browser_status, inspect_json_payload, query_json_payload])
        .run(tauri::generate_context!())
        .expect("error while running Cobweb");
}

// JSON inspection and query commands used by Cobweb's batch-data workspace.
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Serialize)]
struct JsonPathStat {
    types: Vec<String>,
    present: usize,
    unique: usize,
    min: Option<f64>,
    max: Option<f64>,
}

#[derive(Serialize)]
struct JsonInspection {
    records: usize,
    paths: BTreeMap<String, JsonPathStat>,
    structural_patterns: usize,
}

#[derive(serde::Deserialize)]
struct JsonFilter {
    path: String,
    operator: String,
    value: Option<Value>,
}

fn parse_json_records(input: &str) -> Result<Vec<Value>, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() { return Ok(Vec::new()); }
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        return Ok(match value { Value::Array(rows) => rows, one => vec![one] });
    }
    let mut rows = Vec::new();
    for (line_no, line) in trimmed.lines().enumerate() {
        if line.trim().is_empty() { continue; }
        rows.push(serde_json::from_str::<Value>(line).map_err(|e| format!("Invalid JSON/NDJSON at line {}: {}", line_no + 1, e))?);
    }
    Ok(rows)
}

fn flatten_paths(value: &Value, prefix: &str, out: &mut BTreeMap<String, String>) {
    match value {
        Value::Object(map) if !map.is_empty() => for (key, child) in map {
            let path = if prefix.is_empty() { key.clone() } else { format!("{prefix}.{key}") };
            flatten_paths(child, &path, out);
        },
        Value::Array(items) if !items.is_empty() => for (i, child) in items.iter().enumerate() {
            flatten_paths(child, &format!("{prefix}[{i}]"), out);
        },
        Value::Object(_) => { out.insert(if prefix.is_empty() { "$".into() } else { prefix.into() }, "object".into()); },
        Value::Array(_) => { out.insert(if prefix.is_empty() { "$".into() } else { prefix.into() }, "array".into()); },
        Value::Null => { out.insert(if prefix.is_empty() { "$".into() } else { prefix.into() }, "null".into()); },
        Value::Bool(_) => { out.insert(prefix.into(), "bool".into()); },
        Value::Number(n) => { let kind = if n.is_i64() || n.is_u64() { "int" } else { "float" }; out.insert(prefix.into(), kind.into()); },
        Value::String(_) => { out.insert(prefix.into(), "str".into()); },
    }
}

fn path_value<'a>(root: &'a Value, path: &str) -> Option<&'a Value> {
    let normalized = path.replace('[', ".").replace(']', "");
    let mut current = root;
    for part in normalized.split('.').filter(|p| !p.is_empty()) {
        current = match current {
            Value::Object(map) => map.get(part)?,
            Value::Array(items) => items.get(part.parse::<usize>().ok()?)?,
            _ => return None,
        };
    }
    Some(current)
}

#[tauri::command]
fn inspect_json_payload(input: String) -> Result<JsonInspection, String> {
    let records = parse_json_records(&input)?;
    let mut types: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let mut values: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let mut numeric: BTreeMap<String, (f64, f64)> = BTreeMap::new();
    let mut patterns = BTreeSet::new();
    let mut present: BTreeMap<String, usize> = BTreeMap::new();
    for record in &records {
        let mut flattened = BTreeMap::new();
        flatten_paths(record, "", &mut flattened);
        let signature = flattened.iter().map(|(k, v)| format!("{k}:{v}")).collect::<Vec<_>>().join("|");
        patterns.insert(signature);
        for (path, kind) in flattened {
            *present.entry(path.clone()).or_default() += 1;
            types.entry(path.clone()).or_default().insert(kind);
            if let Some(value) = path_value(record, &path) {
                if !value.is_null() { values.entry(path.clone()).or_default().insert(value.to_string()); }
                if let Some(n) = value.as_f64() {
                    numeric.entry(path).and_modify(|r| { r.0 = r.0.min(n); r.1 = r.1.max(n); }).or_insert((n, n));
                }
            }
        }
    }
    let paths = types.into_iter().map(|(path, kinds)| {
        let range = numeric.get(&path).copied();
        let stat = JsonPathStat { types: kinds.into_iter().collect(), present: *present.get(&path).unwrap_or(&0), unique: values.get(&path).map_or(0, BTreeSet::len), min: range.map(|r| r.0), max: range.map(|r| r.1) };
        (path, stat)
    }).collect();
    Ok(JsonInspection { records: records.len(), paths, structural_patterns: patterns.len() })
}

fn validate_http_url(raw: &str) -> Result<Url, String> {
    let input = raw.trim();

    // The WHATWG URL parser may normalize extra slashes after `https:` and
    // interpret the next path segment as a host. Require an explicit,
    // non-empty authority before parsing so `https:///missing-host` fails.
    let (raw_scheme, after_separator) = input
        .split_once("://")
        .ok_or_else(|| "Enter a valid absolute HTTP or HTTPS URL.".to_string())?;
    if !matches!(raw_scheme.to_ascii_lowercase().as_str(), "http" | "https") {
        return Err("URL must use HTTP or HTTPS.".into());
    }
    let authority = after_separator
        .split(|ch| matches!(ch, '/' | '?' | '#'))
        .next()
        .unwrap_or_default();
    if authority.is_empty() || authority.chars().any(char::is_whitespace) {
        return Err("URL must include a valid hostname.".into());
    }

    let parsed = Url::parse(input).map_err(|_| "Enter a valid absolute URL.".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("URL must use HTTP or HTTPS.".into());
    }
    if parsed.host_str().map_or(true, |host| host.trim().is_empty()) {
        return Err("URL must include a valid hostname.".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Credentials embedded in URLs are not allowed.".into());
    }
    Ok(parsed)
}

fn value_as_coerced_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Null => "null".into(),
        _ => value.to_string(),
    }
}

fn json_filter_matches(record: &Value, filter: &JsonFilter) -> bool {
    let actual = path_value(record, &filter.path);
    let expected = filter.value.as_ref().unwrap_or(&Value::Null);
    match filter.operator.as_str() {
        "exists" => actual.map_or(false, |v| !v.is_null()),
        "==" | "$eq" => actual.map_or(false, |a| a == expected || value_as_coerced_string(a) == value_as_coerced_string(expected)),
        "!=" | "$ne" => actual.map_or(true, |a| !(a == expected || value_as_coerced_string(a) == value_as_coerced_string(expected))),
        "regex" | "$regex" => actual.map_or(false, |a| {
            let pattern = match expected.as_str() { Some(p) => p, None => return false };
            if pattern.len() > 4096 { return false; }
            Regex::new(pattern).map(|re| re.is_match(&value_as_coerced_string(a))).unwrap_or(false)
        }),
        ">" | "$gt" => actual.and_then(Value::as_f64).zip(expected.as_f64()).map_or(false, |(a,b)| a>b),
        ">=" | "$gte" => actual.and_then(Value::as_f64).zip(expected.as_f64()).map_or(false, |(a,b)| a>=b),
        "<" | "$lt" => actual.and_then(Value::as_f64).zip(expected.as_f64()).map_or(false, |(a,b)| a<b),
        "<=" | "$lte" => actual.and_then(Value::as_f64).zip(expected.as_f64()).map_or(false, |(a,b)| a<=b),
        "in" | "$in" => expected.as_array().map_or(false, |items| actual.map_or(false, |a| items.contains(a))),
        "contains" | "$contains" => actual.map_or(false, |a| match a { Value::String(s) => expected.as_str().map_or(false, |q| s.contains(q)), Value::Array(xs) => xs.contains(expected), _ => false }),
        _ => false,
    }
}

#[tauri::command]
fn query_json_payload(input: String, filters: Vec<JsonFilter>, fields: Vec<String>, offset: Option<usize>, limit: Option<usize>) -> Result<Vec<Value>, String> {
    let records = parse_json_records(&input)?;
    let matched: Vec<Value> = records.into_iter().filter(|r| filters.iter().all(|f| json_filter_matches(r, f))).collect();
    let start = offset.unwrap_or(0).min(matched.len());
    let end = start.saturating_add(limit.unwrap_or(usize::MAX)).min(matched.len());
    Ok(matched[start..end].iter().map(|r| {
        if fields.is_empty() { return r.clone(); }
        let mut out = Map::new();
        for field in &fields { if let Some(v) = path_value(r, field) { out.insert(field.clone(), v.clone()); } }
        Value::Object(out)
    }).collect())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_json_array_object_and_ndjson() {
        assert_eq!(parse_json_records(r#"[{"a":1},{"a":2}]"#).unwrap().len(), 2);
        assert_eq!(parse_json_records(r#"{"a":1}"#).unwrap().len(), 1);
        assert_eq!(parse_json_records("{\"a\":1}\n{\"a\":2}").unwrap().len(), 2);
        assert!(parse_json_records("{\"a\":1}\ninvalid").is_err());
    }

    #[test]
    fn validates_urls_with_scheme_host_and_no_embedded_credentials() {
        assert!(validate_http_url("https://example.com/path").is_ok());
        assert!(validate_http_url("javascript:alert(1)").is_err());
        assert!(validate_http_url("https:///missing-host").is_err());
        assert!(validate_http_url("https://user:pass@example.com").is_err());
    }

    #[test]
    fn query_supports_regex_and_string_coerced_equality() {
        let record: Value = serde_json::from_str(r#"{"code":123,"name":"Cobweb Runner"}"#).unwrap();
        let equal = JsonFilter { path: "code".into(), operator: "==".into(), value: Some(Value::String("123".into())) };
        let regex = JsonFilter { path: "name".into(), operator: "regex".into(), value: Some(Value::String("^Cobweb.*Runner$".into())) };
        let invalid_regex = JsonFilter { path: "name".into(), operator: "regex".into(), value: Some(Value::String("[".into())) };
        assert!(json_filter_matches(&record, &equal));
        assert!(json_filter_matches(&record, &regex));
        assert!(!json_filter_matches(&record, &invalid_regex));
    }

    #[test]
    fn resolves_nested_and_array_paths() {
        let value: Value = serde_json::from_str(r#"{"user":{"name":"Alice"},"items":[{"price":12}]}"#).unwrap();
        assert_eq!(path_value(&value, "user.name").and_then(Value::as_str), Some("Alice"));
        assert_eq!(path_value(&value, "items[0].price").and_then(Value::as_i64), Some(12));
        assert!(path_value(&value, "user.missing").is_none());
    }

    #[test]
    fn filters_support_numeric_comparison_exists_contains_and_in() {
        let records: Vec<Value> = serde_json::from_str(
            r#"[{"age":29,"name":"Alice","tags":["a","b"]},{"age":19,"name":"Bob","tags":["b"]}]"#
        ).unwrap();
        let filter = |path: &str, operator: &str, value: Option<Value>| JsonFilter {
            path: path.to_string(), operator: operator.to_string(), value
        };
        let count = |f: &JsonFilter| records.iter().filter(|r| json_filter_matches(r, f)).count();
        assert_eq!(count(&filter("age", ">", Some(Value::from(20)))), 1);
        assert_eq!(count(&filter("name", "exists", None)), 2);
        assert_eq!(count(&filter("tags", "contains", Some(Value::from("a")))), 1);
        assert_eq!(count(&filter("name", "in", Some(serde_json::json!(["Alice"])))), 1);
    }

    #[test]
    fn inspect_reports_paths_and_numeric_ranges() {
        let report = inspect_json_payload(r#"[{"user":{"age":20}},{"user":{"age":30}}]"#.into()).unwrap();
        assert_eq!(report.records, 2);
        let age = report.paths.get("user.age").unwrap();
        assert_eq!(age.min, Some(20.0));
        assert_eq!(age.max, Some(30.0));
        assert_eq!(age.present, 2);
    }

    #[test]
    fn query_projects_fields_and_applies_offset_and_limit() {
        let input = r#"[{"id":1,"name":"A"},{"id":2,"name":"B"},{"id":3,"name":"C"}]"#.to_string();
        let result = query_json_payload(input, vec![], vec!["name".into()], Some(1), Some(1)).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].get("name").and_then(Value::as_str), Some("B"));
        assert!(result[0].get("id").is_none());
    }

    #[test]
    fn unknown_filter_operator_fails_closed() {
        let record = serde_json::json!({"a":1});
        let filter = JsonFilter { path: "a".into(), operator: "execute".into(), value: Some(Value::from(1)) };
        assert!(!json_filter_matches(&record, &filter));
    }
}
