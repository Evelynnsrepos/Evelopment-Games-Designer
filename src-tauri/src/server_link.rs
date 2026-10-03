//! WebSocket connections to an Evelopment Games Designer Server (0.8), for
//! `src/core/collab/serverTransport.ts`. Done in Rust so a server with its own
//! (self-signed) certificate can be pinned by fingerprint, and so every OS
//! checks certificates the same way (the system's trust store otherwise).
//! Events reach JS as `[kind u8][conn u32 BE][payload]`: 2 binary, 3 closed, 4 text.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::CryptoProvider;
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, SignatureScheme};
use rustls_platform_verifier::BuilderVerifierExt;
use sha2::{Digest, Sha256};
use tauri::ipc::{Channel, InvokeBody, InvokeResponseBody, Request};
use tauri::State;
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::tungstenite::protocol::WebSocketConfig;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::Connector;

const KIND_BINARY: u8 = 2;
const KIND_CLOSED: u8 = 3;
const KIND_TEXT: u8 = 4;

type Links = Arc<Mutex<HashMap<u32, mpsc::UnboundedSender<Message>>>>;

#[derive(Default)]
pub struct ServerLinks {
  next: AtomicU32,
  links: Links,
}

fn frame(kind: u8, conn: u32, payload: &[u8]) -> InvokeResponseBody {
  let mut out = Vec::with_capacity(5 + payload.len());
  out.push(kind);
  out.extend_from_slice(&conn.to_be_bytes());
  out.extend_from_slice(payload);
  InvokeResponseBody::Raw(out)
}

/// Accepts exactly the certificate whose SHA-256 is `fingerprint` (from the connect code).
/// Handshake signatures are still checked, so only the holder of that certificate's key gets through.
#[derive(Debug)]
struct Pinned {
  fingerprint: String,
  provider: Arc<CryptoProvider>,
}

impl ServerCertVerifier for Pinned {
  fn verify_server_cert(
    &self,
    end_entity: &CertificateDer<'_>,
    _intermediates: &[CertificateDer<'_>],
    _server_name: &ServerName<'_>,
    _ocsp_response: &[u8],
    _now: UnixTime,
  ) -> Result<ServerCertVerified, rustls::Error> {
    let hash: String = Sha256::digest(end_entity.as_ref()).iter().map(|b| format!("{b:02x}")).collect();
    if hash == self.fingerprint {
      Ok(ServerCertVerified::assertion())
    } else {
      Err(rustls::Error::General(
        "This server's certificate changed. Ask its admin for a new connect code.".into(),
      ))
    }
  }

  fn verify_tls12_signature(
    &self,
    message: &[u8],
    cert: &CertificateDer<'_>,
    dss: &DigitallySignedStruct,
  ) -> Result<HandshakeSignatureValid, rustls::Error> {
    rustls::crypto::verify_tls12_signature(message, cert, dss, &self.provider.signature_verification_algorithms)
  }

  fn verify_tls13_signature(
    &self,
    message: &[u8],
    cert: &CertificateDer<'_>,
    dss: &DigitallySignedStruct,
  ) -> Result<HandshakeSignatureValid, rustls::Error> {
    rustls::crypto::verify_tls13_signature(message, cert, dss, &self.provider.signature_verification_algorithms)
  }

  fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
    self.provider.signature_verification_algorithms.supported_schemes()
  }
}

fn client_config(fingerprint: Option<String>) -> Result<ClientConfig, String> {
  let provider = Arc::new(rustls::crypto::ring::default_provider());
  let builder = ClientConfig::builder_with_provider(provider.clone())
    .with_safe_default_protocol_versions()
    .map_err(|e| e.to_string())?;
  let config = match fingerprint {
    Some(fingerprint) => builder
      .dangerous()
      .with_custom_certificate_verifier(Arc::new(Pinned { fingerprint: fingerprint.to_lowercase(), provider }))
      .with_no_client_auth(),
    None => builder.with_platform_verifier().map_err(|e| e.to_string())?.with_no_client_auth(),
  };
  Ok(config)
}

/// Open a connection. Returns its id; messages arrive on `on_event`.
#[tauri::command]
pub async fn server_connect(
  state: State<'_, ServerLinks>,
  url: String,
  fingerprint: Option<String>,
  on_event: Channel<InvokeResponseBody>,
) -> Result<u32, String> {
  if !url.starts_with("wss://") && !url.starts_with("ws://") {
    return Err("That is not a server address.".into());
  }
  let connector = Connector::Rustls(Arc::new(client_config(fingerprint)?));
  let config = WebSocketConfig::default().max_message_size(Some(64 << 20)).max_frame_size(Some(64 << 20));
  let (ws, _) = tokio_tungstenite::connect_async_tls_with_config(url.as_str(), Some(config), false, Some(connector))
    .await
    .map_err(|e| format!("Could not reach the server: {e}"))?;
  let conn = state.next.fetch_add(1, Ordering::Relaxed) + 1;
  let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
  state.links.lock().await.insert(conn, tx);
  let (mut sink, mut stream) = ws.split();

  tauri::async_runtime::spawn(async move {
    while let Some(message) = rx.recv().await {
      let close = matches!(message, Message::Close(_));
      if sink.send(message).await.is_err() || close {
        break;
      }
    }
    let _ = sink.close().await;
  });

  let links = state.links.clone();
  tauri::async_runtime::spawn(async move {
    let mut reason = String::new();
    while let Some(message) = stream.next().await {
      match message {
        Ok(Message::Binary(b)) => {
          let _ = on_event.send(frame(KIND_BINARY, conn, &b));
        }
        Ok(Message::Text(t)) => {
          let _ = on_event.send(frame(KIND_TEXT, conn, t.as_bytes()));
        }
        Ok(Message::Close(c)) => {
          reason = c.map(|c| c.reason.to_string()).unwrap_or_default();
          break;
        }
        Ok(_) => {}
        Err(e) => {
          reason = e.to_string();
          break;
        }
      }
    }
    links.lock().await.remove(&conn);
    let _ = on_event.send(frame(KIND_CLOSED, conn, reason.as_bytes()));
  });
  Ok(conn)
}

async fn sender(state: &State<'_, ServerLinks>, conn: u32) -> Result<mpsc::UnboundedSender<Message>, String> {
  state.links.lock().await.get(&conn).cloned().ok_or_else(|| "not connected".to_string())
}

/// Send one binary message. Body: raw bytes. Header `x-conn`: connection id.
#[tauri::command]
pub async fn server_send(state: State<'_, ServerLinks>, request: Request<'_>) -> Result<(), String> {
  let conn: u32 = request
    .headers()
    .get("x-conn")
    .and_then(|v| v.to_str().ok())
    .and_then(|v| v.parse().ok())
    .ok_or("missing x-conn header")?;
  let InvokeBody::Raw(data) = request.body() else {
    return Err("expected raw bytes".into());
  };
  sender(&state, conn).await?.send(Message::Binary(data.clone().into())).map_err(|_| "not connected".to_string())
}

#[tauri::command]
pub async fn server_send_text(state: State<'_, ServerLinks>, conn: u32, text: String) -> Result<(), String> {
  sender(&state, conn).await?.send(Message::Text(text.into())).map_err(|_| "not connected".to_string())
}

#[tauri::command]
pub async fn server_close(state: State<'_, ServerLinks>, conn: u32) -> Result<(), String> {
  if let Some(tx) = state.links.lock().await.remove(&conn) {
    let _ = tx.send(Message::Close(None));
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  /// Against a running server in self-signed mode:
  /// EGD_TEST_WSS_URL=wss://127.0.0.1:8474/sync EGD_TEST_FINGERPRINT=<hex> cargo test server_link
  #[tokio::test]
  async fn pins_the_certificate() {
    let (Ok(url), Ok(fingerprint)) = (std::env::var("EGD_TEST_WSS_URL"), std::env::var("EGD_TEST_FINGERPRINT")) else {
      return;
    };
    let connect = |fpr: String| {
      let url = url.clone();
      async move {
        let connector = Connector::Rustls(Arc::new(client_config(Some(fpr)).unwrap()));
        tokio_tungstenite::connect_async_tls_with_config(url.as_str(), None, false, Some(connector)).await
      }
    };
    let (mut ws, _) = connect(fingerprint.clone()).await.expect("the right fingerprint connects");
    ws.send(Message::Text(r#"{"type":"auth","key":"egd-key-nope"}"#.into())).await.unwrap();
    let reply = ws.next().await.unwrap().unwrap();
    assert!(reply.to_text().unwrap().contains("bad-key"));
    let wrong = "0".repeat(64);
    assert!(connect(wrong).await.is_err(), "another certificate is refused");
    // Without pinning, the system trust store refuses a self-signed certificate.
    let connector = Connector::Rustls(Arc::new(client_config(None).unwrap()));
    assert!(tokio_tungstenite::connect_async_tls_with_config(url.as_str(), None, false, Some(connector)).await.is_err());
  }
}
