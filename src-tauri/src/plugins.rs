//! Plugin "store" download (v0.4): fetches a plugin zip from a GitHub repo.
//! The app only accepts github.com repos; the zip is unpacked and checked in JS.

use std::io::Read;

const MAX_BYTES: u64 = 50 * 1024 * 1024;

fn get(url: &str) -> Result<Vec<u8>, String> {
  let resp = ureq::get(url).header("User-Agent", "Evelopment-Games-Designer").call().map_err(|e| format!("Download failed: {e}"))?;
  let mut bytes = Vec::new();
  resp.into_body().into_reader().take(MAX_BYTES + 1).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
  if bytes.len() as u64 > MAX_BYTES {
    return Err("The plugin is larger than 50 MB.".into());
  }
  Ok(bytes)
}

fn valid_part(s: &str) -> bool {
  !s.is_empty() && s.len() <= 100 && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.')) && s != "." && s != ".."
}

/// The latest release's first .zip asset, or the default branch as a zip when the repo has no releases.
#[tauri::command]
pub async fn plugin_download(owner: String, repo: String) -> Result<tauri::ipc::Response, String> {
  if !valid_part(&owner) || !valid_part(&repo) {
    return Err("That is not a GitHub repository.".into());
  }
  tauri::async_runtime::spawn_blocking(move || {
    let api = format!("https://api.github.com/repos/{owner}/{repo}/releases/latest");
    let asset = ureq::get(&api)
      .header("User-Agent", "Evelopment-Games-Designer")
      .call()
      .ok()
      .and_then(|mut r| r.body_mut().read_json::<serde_json::Value>().ok())
      .and_then(|json| {
        json["assets"].as_array()?.iter().find_map(|a| {
          let url = a["browser_download_url"].as_str()?;
          url.ends_with(".zip").then(|| url.to_string())
        })
      });
    let url = asset.unwrap_or_else(|| format!("https://codeload.github.com/{owner}/{repo}/zip/HEAD"));
    get(&url).map(tauri::ipc::Response::new)
  })
  .await
  .map_err(|e| e.to_string())?
}
