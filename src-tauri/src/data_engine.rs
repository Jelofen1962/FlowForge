use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldSummary {
    pub name: String,
    pub types: Vec<String>,
    pub presence_percent: f64,
    pub unique_count: usize,
    pub numeric_min: Option<f64>,
    pub numeric_max: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSummary {
    pub row_count: usize,
    pub fields: Vec<FieldSummary>,
}

pub fn parse_records(input: &str) -> Result<Vec<Value>, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() { return Ok(vec![]); }
    let parsed = serde_json::from_str::<Value>(trimmed);
    if let Ok(Value::Array(rows)) = parsed { return ensure_objects(rows); }
    if let Ok(Value::Object(obj)) = parsed { 
        if let Some(Value::Array(rows)) = obj.get("data") { return ensure_objects(rows.clone()); }
        return Ok(vec![Value::Object(obj)]);
    }
    let mut rows = Vec::new();
    for (index, line) in input.lines().enumerate().filter(|(_, l)| !l.trim().is_empty()) {
        let value: Value = serde_json::from_str(line).map_err(|e| format!("Invalid JSON/NDJSON on line {}: {e}", index + 1))?;
        if !value.is_object() { return Err(format!("NDJSON line {} must be a JSON object.", index + 1)); }
        rows.push(value);
    }
    Ok(rows)
}

fn ensure_objects(rows: Vec<Value>) -> Result<Vec<Value>, String> {
    if rows.iter().any(|v| !v.is_object()) { return Err("JSON data must be an array of objects.".into()); }
    Ok(rows)
}

pub fn summarize(rows: &[Value]) -> DataSummary {
    let mut names = BTreeMap::<String, Vec<&Value>>::new();
    for row in rows {
        if let Some(obj) = row.as_object() {
            for key in obj.keys() { names.entry(key.clone()).or_default(); }
        }
    }
    for (name, values) in names.iter_mut() {
        *values = rows.iter().filter_map(|r| r.get(name)).collect();
    }
    let fields = names.into_iter().map(|(name, values)| {
        let mut types = HashSet::new();
        let mut unique = HashSet::new();
        let mut min: Option<f64> = None;
        let mut max: Option<f64> = None;
        for v in &values {
            types.insert(match v { Value::Null => "null", Value::Bool(_) => "boolean", Value::Number(_) => "number", Value::String(_) => "string", Value::Array(_) => "array", Value::Object(_) => "object" }.to_string());
            unique.insert(v.to_string());
            if let Some(n) = v.as_f64() {
                min = Some(min.map_or(n, |x| x.min(n)));
                max = Some(max.map_or(n, |x| x.max(n)));
            }
        }
        let mut types: Vec<_> = types.into_iter().collect(); types.sort();
        FieldSummary {
            name, types,
            presence_percent: if rows.is_empty() { 0.0 } else { values.len() as f64 * 100.0 / rows.len() as f64 },
            unique_count: unique.len(), numeric_min: min, numeric_max: max,
        }
    }).collect();
    DataSummary { row_count: rows.len(), fields }
}

pub fn filter_records(rows: &[Value], field: &str, operator: &str, operand: &Value) -> Result<Vec<Value>, String> {
    let regex = if operator == "regex" {
        Some(Regex::new(operand.as_str().ok_or("regex operand must be a string")?)
            .map_err(|e| format!("Invalid regex: {e}"))?)
    } else { None };
    let allowed = ["==", "!=", ">", ">=", "<", "<=", "contains", "regex", "exists", "in"];
    if !allowed.contains(&operator) { return Err(format!("Unsupported filter operator: {operator}")); }
    Ok(rows.iter().filter(|row| {
        let current = row.get(field);
        match operator {
            "exists" => current.is_some() && !current.unwrap().is_null(),
            "==" => current == Some(operand),
            "!=" => current != Some(operand),
            ">" | ">=" | "<" | "<=" => current.and_then(Value::as_f64).zip(operand.as_f64()).map(|(a,b)| match operator { ">"=>a>b, ">="=>a>=b, "<"=>a<b, _=>a<=b }).unwrap_or(false),
            "contains" => current.and_then(Value::as_str).zip(operand.as_str()).map(|(a,b)| a.contains(b)).unwrap_or(false),
            "regex" => current.and_then(Value::as_str).map(|s| regex.as_ref().unwrap().is_match(s)).unwrap_or(false),
            "in" => operand.as_array().map(|a| current.map(|v| a.contains(v)).unwrap_or(false)).unwrap_or(false),
            _ => false,
        }
    }).cloned().collect())
}

pub fn resolve_bindings(value: &str, row: &Value, env: &Map<String, Value>, prior_steps: &[Value]) -> Result<String, String> {
    let token = Regex::new(r"\{\{\s*([^{}]+?)\s*\}\}").unwrap();
    let mut output = String::new();
    let env_value = Value::Object(env.clone());
    let mut last = 0;
    for captures in token.captures_iter(value) {
        let m = captures.get(0).unwrap();
        output.push_str(&value[last..m.start()]);
        let path = captures.get(1).unwrap().as_str();
        let resolved = if let Some(p) = path.strip_prefix("row.") { lookup_path(row, p) }
            else if let Some(p) = path.strip_prefix("env.") { lookup_path(&env_value, p) }
            else if let Some(p) = path.strip_prefix("steps[") {
                let (index, rest) = p.split_once(']').ok_or_else(|| format!("Invalid step variable: {path}"))?;
                let i: usize = index.parse().map_err(|_| format!("Invalid step index in {path}"))?;
                let base = prior_steps.get(i).ok_or_else(|| format!("Step variable out of range: {path}"))?;
                if rest.is_empty() { Some(base) } else { lookup_path(base, rest.trim_start_matches('.')) }
            } else { return Err(format!("Unknown variable namespace in {{{{{path}}}}}")); };
        let resolved = resolved.ok_or_else(|| format!("Variable not found: {path}"))?;
        output.push_str(match resolved { Value::String(s) => s.clone(), _ => resolved.to_string() }.as_str());
        last = m.end();
    }
    output.push_str(&value[last..]);
    Ok(output)
}

fn lookup_path<'a>(root: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = root;
    for part in path.split('.').filter(|p| !p.is_empty()) {
        if let Ok(i) = part.parse::<usize>() { current = current.get(i)?; }
        else { current = current.get(part)?; }
    }
    Some(current)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_json_array_and_ndjson() {
        assert_eq!(parse_records(r#"[{"id":1},{"id":2}]"#).unwrap().len(), 2);
        assert_eq!(parse_records("{\"id\":1}\n{\"id\":2}\n").unwrap().len(), 2);
    }
    #[test]
    fn rejects_non_object_rows() {
        assert!(parse_records("[1,2]").is_err());
    }
    #[test]
    fn summary_reports_presence_and_numeric_range() {
        let rows = parse_records(r#"[{"n":1},{"n":3},{"x":true}]"#).unwrap();
        let summary = summarize(&rows);
        let n = summary.fields.iter().find(|f| f.name == "n").unwrap();
        assert_eq!(n.numeric_min, Some(1.0));
        assert!((n.presence_percent - 66.666).abs() < 0.01);
    }
    #[test]
    fn filter_and_variable_binding_work() {
        let rows = parse_records(r#"[{"name":"Ada","age":37},{"name":"Bob","age":20}]"#).unwrap();
        assert_eq!(filter_records(&rows, "age", ">=", &Value::from(30)).unwrap().len(), 1);
        let env = Map::new();
        assert_eq!(resolve_bindings("Hello {{row.name}}", &rows[0], &env, &[]).unwrap(), "Hello Ada");
    }
    #[test]
    fn regex_errors_are_reported() {
        assert!(filter_records(&[], "x", "regex", &Value::from("[")).is_err());
    }
}
