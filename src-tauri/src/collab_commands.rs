//! Tauri commands for the collaboration transport (`collab.rs`).
//! The frontend side is `src/core/collab/tauriTransport.ts`.

use std::sync::Arc;

use tauri::ipc::{Channel, InvokeBody, InvokeResponseBody, Request};
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

use crate::collab::{load_or_create_secret, EventSink, NetMode, Node};

#[derive(Default)]
pub struct CollabState(Mutex<Option<Arc<Node>>>);

struct ChannelSink(Channel<InvokeResponseBody>);

impl EventSink for ChannelSink {
  fn emit(&self, frame: Vec<u8>) {
    let _ = self.0.send(InvokeResponseBody::Raw(frame));
  }
}

async fn node(state: &State<'_, CollabState>) -> Result<Arc<Node>, String> {
  state
    .0
    .lock()
    .await
    .clone()
    .ok_or_else(|| "collaboration is not running".to_string())
}

/// Start networking (or restart it with a new event channel). Returns this device's id.
#[tauri::command]
pub async fn collab_start(
  app: AppHandle,
  state: State<'_, CollabState>,
  on_event: Channel<InvokeResponseBody>,
) -> Result<String, String> {
  let mut slot = state.0.lock().await;
  if let Some(old) = slot.take() {
    old.stop().await;
  }
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let secret = load_or_create_secret(&dir.join("collab-key")).map_err(|e| e.to_string())?;
  let node = Node::start(secret, Arc::new(ChannelSink(on_event)), NetMode::Internet)
    .await
    .map_err(|e| e.to_string())?;
  let id = node.id().to_string();
  *slot = Some(node);
  Ok(id)
}

/// This device's full address (id, relay, direct addresses) as JSON, for invites.
#[tauri::command]
pub async fn collab_addr(state: State<'_, CollabState>) -> Result<String, String> {
  node(&state)
    .await?
    .addr_json(true)
    .await
    .map_err(|e| e.to_string())
}

/// Dial a peer by address JSON or endpoint id. Returns the connection id.
#[tauri::command]
pub async fn collab_connect(state: State<'_, CollabState>, addr: String) -> Result<u32, String> {
  node(&state)
    .await?
    .connect(&addr)
    .await
    .map_err(|e| e.to_string())
}

/// Send one message. Body: raw bytes. Header `x-conn`: connection id.
#[tauri::command]
pub async fn collab_send(state: State<'_, CollabState>, request: Request<'_>) -> Result<(), String> {
  let conn: u32 = request
    .headers()
    .get("x-conn")
    .and_then(|v| v.to_str().ok())
    .and_then(|v| v.parse().ok())
    .ok_or("missing x-conn header")?;
  let InvokeBody::Raw(data) = request.body() else {
    return Err("expected raw bytes".into());
  };
  let data = data.clone();
  node(&state)
    .await?
    .send(conn, data)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn collab_disconnect(state: State<'_, CollabState>, conn: u32) -> Result<(), String> {
  node(&state).await?.disconnect(conn).await;
  Ok(())
}

#[tauri::command]
pub async fn collab_stop(state: State<'_, CollabState>) -> Result<(), String> {
  if let Some(node) = state.0.lock().await.take() {
    node.stop().await;
  }
  Ok(())
}
