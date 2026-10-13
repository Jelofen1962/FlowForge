use super::{client::CdpSession, protocol::ElementMatch};
use serde_json::json;

pub async fn find_element(session: &CdpSession, selector: &str) -> Result<Option<ElementMatch>, String> {
    if selector.trim().is_empty() { return Err("Selector cannot be empty.".into()); }
    let expression = format!(r#"(() => {{
      const s = {};
      let el = null;
      try {{
        if (s.startsWith("xpath:")) {{
          el = document.evaluate(s.slice(6), document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        }} else if (s.startsWith("text:")) {{
          const needle = s.slice(5).trim().toLowerCase();
          el = [...document.querySelectorAll("button,a,input,[role=button],label,span,div")].find(n => (n.innerText || n.value || "").trim().toLowerCase().includes(needle));
        }} else {{
          el = document.querySelector(s.replace(/^css:/, ""));
        }}
      }} catch (_) {{ return {{error:"invalid-selector"}}; }}
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {{selector:s, tagName:el.tagName.toLowerCase(), text:(el.innerText || el.value || "").trim().slice(0,500), x:r.x+r.width/2, y:r.y+r.height/2, width:r.width, height:r.height}};
    }})()"#, serde_json::to_string(selector).unwrap());
    let value = session.evaluate(&expression).await?;
    if value.is_null() { return Ok(None); }
    if value.get("error").is_some() { return Err("Invalid element selector.".into()); }
    serde_json::from_value(value).map(Some).map_err(|e| format!("Could not parse element match: {e}"))
}

pub async fn wait_for_selector(session: &CdpSession, selector: &str, timeout_ms: u64) -> Result<ElementMatch, String> {
    let started = tokio::time::Instant::now();
    let timeout = std::time::Duration::from_millis(timeout_ms.clamp(100, 120_000));
    loop {
        if let Some(found) = find_element(session, selector).await? { return Ok(found); }
        if started.elapsed() >= timeout { return Err(format!("Timed out waiting for selector: {selector}")); }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
}

pub async fn click_selector(session: &CdpSession, selector: &str, timeout_ms: u64) -> Result<(), String> {
    let found = wait_for_selector(session, selector, timeout_ms).await?;
    let (x, y) = (found.x.ok_or("Element has no x coordinate.")?, found.y.ok_or("Element has no y coordinate.")?);
    session.click_at(x, y).await
}

pub async fn type_into_selector(session: &CdpSession, selector: &str, text: &str, timeout_ms: u64) -> Result<(), String> {
    let _ = wait_for_selector(session, selector, timeout_ms).await?;
    let expression = format!("(() => {{ const s = {}; let e; try {{ e = s.startsWith('xpath:') ? document.evaluate(s.slice(6),document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue : document.querySelector(s.replace(/^css:/,'')); }} catch (_) {{ return false; }} if (!e) return false; e.focus(); if ('value' in e) {{ e.value = ''; e.dispatchEvent(new Event('input',{{bubbles:true}})); }} return true; }})()", serde_json::to_string(selector).unwrap());
    if session.evaluate(&expression).await? != json!(true) { return Err("Could not focus element for typing.".into()); }
    session.insert_text(text).await
}

#[cfg(test)]
mod tests {
    #[test]
    fn selector_is_json_escaped_before_injection() {
        let selector = r#"input[name="x"]; alert(1)//"#;
        let encoded = serde_json::to_string(selector).unwrap();
        assert!(encoded.starts_with('"') && encoded.ends_with('"'));
        assert!(encoded.contains(r#"\""#));
    }
}
