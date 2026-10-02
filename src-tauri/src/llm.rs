//! Optional AI helper for spelling suggestions (v0.4). Nothing ships with the
//! app: the user downloads llama.cpp's `llama-server` and a small model from
//! Settings into `<app data>/llm/`. The server runs on 127.0.0.1 only while
//! the app is open and is started on the first request.

use serde::Serialize;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

/// Pinned so the archive layout and server flags stay known.
const LLAMA_TAG: &str = "b11347";
const MODEL_URL: &str =
  "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf";
const MODEL_FILE: &str = "model.gguf";

#[derive(Default)]
pub struct LlmState {
  server: Mutex<Option<(Child, u16)>>,
  installing: Mutex<bool>,
}

#[derive(Clone, Serialize)]
pub struct Progress {
  stage: &'static str,
  done: u64,
  total: u64,
}

fn llama_archive() -> Result<&'static str, String> {
  Ok(match (std::env::consts::OS, std::env::consts::ARCH) {
    ("windows", "x86_64") => "bin-win-cpu-x64.zip",
    ("windows", "aarch64") => "bin-win-cpu-arm64.zip",
    ("macos", "aarch64") => "bin-macos-arm64.tar.gz",
    ("macos", "x86_64") => "bin-macos-x64.tar.gz",
    ("linux", "x86_64") => "bin-ubuntu-x64.tar.gz",
    (os, arch) => return Err(format!("The AI helper is not available for {os} {arch}.")),
  })
}

fn llm_dir(app: &AppHandle) -> Result<PathBuf, String> {
  Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("llm"))
}

fn server_exe() -> &'static str {
  if cfg!(windows) { "llama-server.exe" } else { "llama-server" }
}

/// Windows' own bsdtar (System32) also reads zip; a GNU tar earlier on PATH (Git Bash) would not.
fn tar_exe() -> PathBuf {
  if cfg!(windows) {
    let root = std::env::var_os("SystemRoot").unwrap_or_else(|| r"C:\Windows".into());
    Path::new(&root).join("System32").join("tar.exe")
  } else {
    PathBuf::from("tar")
  }
}

fn find_file(dir: &Path, name: &str) -> Option<PathBuf> {
  for entry in fs::read_dir(dir).ok()?.flatten() {
    let path = entry.path();
    if path.is_dir() {
      if let Some(found) = find_file(&path, name) {
        return Some(found);
      }
    } else if path.file_name().is_some_and(|n| n == name) {
      return Some(path);
    }
  }
  None
}

fn installed(dir: &Path) -> Option<(PathBuf, PathBuf)> {
  let model = dir.join(MODEL_FILE);
  let server = find_file(&dir.join("bin"), server_exe())?;
  model.is_file().then_some((server, model))
}

/// Stream a URL to `dest`, reporting progress; written to `.part` first so a cancelled download never looks finished.
fn download(url: &str, dest: &Path, stage: &'static str, progress: &Channel<Progress>) -> Result<(), String> {
  let resp = ureq::get(url).call().map_err(|e| format!("Download failed: {e}"))?;
  let total = resp.headers().get("content-length").and_then(|v| v.to_str().ok()?.parse().ok()).unwrap_or(0);
  let mut reader = resp.into_body().into_reader();
  let part = dest.with_extension("part");
  let mut file = fs::File::create(&part).map_err(|e| e.to_string())?;
  let mut buf = vec![0u8; 1 << 20];
  let (mut done, mut last) = (0u64, Instant::now());
  loop {
    let n = reader.read(&mut buf).map_err(|e| format!("Download failed: {e}"))?;
    if n == 0 {
      break;
    }
    file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
    done += n as u64;
    if last.elapsed() > Duration::from_millis(250) {
      let _ = progress.send(Progress { stage, done, total });
      last = Instant::now();
    }
  }
  drop(file);
  fs::rename(&part, dest).map_err(|e| e.to_string())
}

fn install(dir: &Path, progress: &Channel<Progress>) -> Result<(), String> {
  fs::create_dir_all(dir).map_err(|e| e.to_string())?;
  let bin = dir.join("bin");
  if find_file(&bin, server_exe()).is_none() {
    let name = format!("llama-{LLAMA_TAG}-{}", llama_archive()?);
    let url = format!("https://github.com/ggml-org/llama.cpp/releases/download/{LLAMA_TAG}/{name}");
    let archive = dir.join(&name);
    download(&url, &archive, "program", progress)?;
    let _ = fs::remove_dir_all(&bin);
    fs::create_dir_all(&bin).map_err(|e| e.to_string())?;
    // `tar` ships with Windows 10+, macOS and Linux and unpacks both .zip and .tar.gz.
    let status = Command::new(tar_exe()).arg("-xf").arg(&archive).arg("-C").arg(&bin).status().map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&archive);
    if !status.success() || find_file(&bin, server_exe()).is_none() {
      return Err("Could not unpack the AI helper program.".into());
    }
  }
  if !dir.join(MODEL_FILE).is_file() {
    download(MODEL_URL, &dir.join(MODEL_FILE), "model", progress)?;
  }
  Ok(())
}

#[tauri::command]
pub async fn llm_status(app: AppHandle) -> Result<bool, String> {
  Ok(installed(&llm_dir(&app)?).is_some())
}

#[tauri::command]
pub async fn llm_install(app: AppHandle, progress: Channel<Progress>) -> Result<(), String> {
  let state = app.state::<LlmState>();
  {
    let mut busy = state.installing.lock().unwrap();
    if *busy {
      return Err("The AI helper is already downloading.".into());
    }
    *busy = true;
  }
  let dir = llm_dir(&app)?;
  let result = tauri::async_runtime::spawn_blocking(move || install(&dir, &progress)).await.map_err(|e| e.to_string())?;
  *state.installing.lock().unwrap() = false;
  result
}

#[tauri::command]
pub async fn llm_remove(app: AppHandle) -> Result<(), String> {
  stop(&app);
  let dir = llm_dir(&app)?;
  if dir.exists() {
    fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
  }
  Ok(())
}

/// Stop the server; called on remove and when the app exits.
pub fn stop(app: &AppHandle) {
  if let Some((mut child, _)) = app.state::<LlmState>().server.lock().unwrap().take() {
    let _ = child.kill();
    let _ = child.wait();
  }
}

fn ensure_server(app: &AppHandle) -> Result<u16, String> {
  let state = app.state::<LlmState>();
  let mut server = state.server.lock().unwrap();
  if let Some((child, port)) = server.as_mut() {
    if child.try_wait().map_err(|e| e.to_string())?.is_none() {
      return Ok(*port);
    }
  }
  let (exe, model) = installed(&llm_dir(app)?).ok_or("The AI helper is not downloaded.")?;
  let port = TcpListener::bind("127.0.0.1:0").and_then(|l| l.local_addr()).map_err(|e| e.to_string())?.port();
  let mut cmd = Command::new(&exe);
  cmd
    .arg("-m").arg(&model)
    .args(["--host", "127.0.0.1", "--port", &port.to_string(), "-c", "2048"])
    .current_dir(exe.parent().unwrap())
    .stdout(Stdio::null())
    .stderr(Stdio::null());
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
  }
  let child = cmd.spawn().map_err(|e| format!("Could not start the AI helper: {e}"))?;
  *server = Some((child, port));
  drop(server);

  let started = Instant::now();
  while started.elapsed() < Duration::from_secs(90) {
    if ureq::get(&format!("http://127.0.0.1:{port}/health")).call().is_ok() {
      return Ok(port);
    }
    std::thread::sleep(Duration::from_millis(300));
  }
  stop(app);
  Err("The AI helper did not start.".into())
}

/// Ask the model for corrected spellings of `word` as used in `context`.
#[tauri::command]
pub async fn llm_suggest(app: AppHandle, word: String, context: String) -> Result<Vec<String>, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let port = ensure_server(&app)?;
    let body = serde_json::json!({
      "messages": [
        { "role": "system", "content": "You correct spelling in English or German text. Reply with up to 3 corrected spellings of the given word, one per line, and nothing else." },
        { "role": "user", "content": format!("Text: {context}\nMisspelled word: {word}") }
      ],
      "temperature": 0.2,
      "max_tokens": 40
    });
    let mut resp = ureq::post(&format!("http://127.0.0.1:{port}/v1/chat/completions"))
      .send_json(&body)
      .map_err(|e| format!("The AI helper failed: {e}"))?;
    let json: serde_json::Value = resp.body_mut().read_json().map_err(|e| e.to_string())?;
    let text = json["choices"][0]["message"]["content"].as_str().unwrap_or_default();
    Ok(parse_suggestions(text, &word))
  })
  .await
  .map_err(|e| e.to_string())?
}

/// One word per line; drops numbering, quotes, the original word and duplicates.
fn parse_suggestions(text: &str, word: &str) -> Vec<String> {
  let mut out: Vec<String> = Vec::new();
  for line in text.lines() {
    let s = line
      .trim()
      .trim_start_matches(|c: char| c.is_ascii_digit() || matches!(c, '.' | ')' | '-' | '*' | ' '))
      .trim_matches(|c: char| matches!(c, '"' | '\'' | '`' | '.' | ',' | ' '));
    if !s.is_empty() && !s.contains(' ') && s != word && !out.iter().any(|o| o == s) {
      out.push(s.to_string());
    }
  }
  out.truncate(3);
  out
}

#[cfg(test)]
mod tests {
  use super::parse_suggestions;

  #[test]
  fn parses_model_replies() {
    assert_eq!(parse_suggestions("1. castle\n2. \"cancel\"\ncastel\ncastle\n", "castel"), vec!["castle", "cancel"]);
    assert!(parse_suggestions("Sure, here you go", "x").is_empty());
  }
}
