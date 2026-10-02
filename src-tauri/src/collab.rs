//! Peer-to-peer transport for collaboration (see docs/COLLABORATION.md).
//!
//! Rust only moves bytes: it opens an iroh endpoint, accepts and dials
//! connections and frames messages on one bidirectional QUIC stream per peer.
//! Everything about projects, Yjs sync, invites and assets lives in
//! TypeScript (`src/core/collab/`), so the same protocol also runs over the
//! browser dev transport and any future server transport.
//!
//! Events go to the frontend as raw binary frames on one channel:
//! `[kind: u8][connection id: u32 BE][payload]`, see `EventKind`.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

use anyhow::{anyhow, bail, Context, Result};
use iroh::endpoint::{presets, Connection, RecvStream, SendStream};
use iroh::{Endpoint, EndpointAddr, EndpointId, SecretKey};
use tokio::sync::{mpsc, Mutex};

/// QUIC application protocol name. Bump the suffix on breaking wire changes.
pub const ALPN: &[u8] = b"egd/collab/1";
/// Largest single message. Assets are sent in chunks below this.
pub const MAX_MESSAGE: usize = 8 * 1024 * 1024;
/// Sent by the dialing side so the stream shows up on the other end.
const STREAM_HELLO: &[u8] = b"EGD1";

#[derive(Clone, Copy)]
#[repr(u8)]
pub enum EventKind {
  /// Payload: `<remote endpoint id>` as UTF-8.
  Connected = 1,
  /// Payload: one message.
  Message = 2,
  /// Payload: optional reason as UTF-8.
  Closed = 3,
}

pub fn frame(kind: EventKind, conn: u32, payload: &[u8]) -> Vec<u8> {
  let mut out = Vec::with_capacity(5 + payload.len());
  out.push(kind as u8);
  out.extend_from_slice(&conn.to_be_bytes());
  out.extend_from_slice(payload);
  out
}

/// Where events go: the Tauri channel in the app, a test channel in tests.
pub trait EventSink: Send + Sync + 'static {
  fn emit(&self, frame: Vec<u8>);
}

impl EventSink for mpsc::UnboundedSender<Vec<u8>> {
  fn emit(&self, frame: Vec<u8>) {
    let _ = self.send(frame);
  }
}

#[derive(Clone, Copy, Debug)]
#[cfg_attr(not(test), allow(dead_code))]
pub enum NetMode {
  /// Direct connections with relay fallback and peer lookup by id (the app).
  Internet,
  /// Everything through the relay, to test the worst case (CI).
  RelayOnly,
  /// Direct only, no lookup (unit tests on one machine).
  Local,
}

struct Peer {
  outgoing: mpsc::UnboundedSender<Vec<u8>>,
  connection: Connection,
}

/// One running endpoint and its open connections.
pub struct Node {
  endpoint: Endpoint,
  peers: Arc<Mutex<HashMap<u32, Peer>>>,
  next_id: Arc<AtomicU32>,
  sink: Arc<dyn EventSink>,
}

impl Node {
  /// Bind an endpoint with the given identity.
  pub async fn start(secret: SecretKey, sink: Arc<dyn EventSink>, mode: NetMode) -> Result<Arc<Node>> {
    let builder = match mode {
      NetMode::Internet => Endpoint::builder(presets::N0),
      NetMode::RelayOnly => Endpoint::builder(presets::N0).clear_ip_transports(),
      NetMode::Local => Endpoint::builder(presets::N0DisableRelay).clear_address_lookup(),
    };
    let endpoint = builder
      .secret_key(secret)
      .alpns(vec![ALPN.to_vec()])
      .bind()
      .await
      .map_err(|e| anyhow!("could not start networking: {e}"))?;
    let node = Arc::new(Node {
      endpoint,
      peers: Arc::new(Mutex::new(HashMap::new())),
      next_id: Arc::new(AtomicU32::new(1)),
      sink,
    });
    let accepting = node.clone();
    tokio::spawn(async move { accepting.accept_loop().await });
    Ok(node)
  }

  pub fn id(&self) -> EndpointId {
    self.endpoint.id()
  }

  /// Our address as JSON, waiting a little for the relay so invites work from anywhere.
  pub async fn addr_json(&self, wait_online: bool) -> Result<String> {
    if wait_online {
      let _ = tokio::time::timeout(std::time::Duration::from_secs(8), self.endpoint.online()).await;
    }
    Ok(serde_json::to_string(&self.endpoint.addr())?)
  }

  async fn accept_loop(self: Arc<Self>) {
    while let Some(incoming) = self.endpoint.accept().await {
      let node = self.clone();
      tokio::spawn(async move {
        let result: Result<()> = async {
          let connection = incoming.await.map_err(|e| anyhow!("{e}"))?;
          let (send, mut recv) = connection.accept_bi().await.map_err(|e| anyhow!("{e}"))?;
          let mut hello = [0u8; 4];
          recv.read_exact(&mut hello).await.map_err(|e| anyhow!("{e}"))?;
          if hello != STREAM_HELLO {
            bail!("unknown protocol");
          }
          node.attach(connection, send, recv).await;
          Ok(())
        }
        .await;
        if let Err(e) = result {
          log::warn!("incoming collab connection failed: {e}");
        }
      });
    }
  }

  /// Dial a peer by address JSON (from an invite) or bare endpoint id (a known member).
  pub async fn connect(&self, addr: &str) -> Result<u32> {
    let addr: EndpointAddr = if addr.trim_start().starts_with('{') {
      serde_json::from_str(addr).context("invalid peer address")?
    } else {
      addr
        .trim()
        .parse::<EndpointId>()
        .map_err(|e| anyhow!("invalid peer id: {e}"))?
        .into()
    };
    if addr.id == self.endpoint.id() {
      bail!("cannot connect to yourself");
    }
    let connection = self
      .endpoint
      .connect(addr, ALPN)
      .await
      .map_err(|e| anyhow!("{e}"))?;
    let (mut send, recv) = connection.open_bi().await.map_err(|e| anyhow!("{e}"))?;
    send.write_all(STREAM_HELLO).await?;
    Ok(self.attach(connection, send, recv).await)
  }

  async fn attach(&self, connection: Connection, send: SendStream, recv: RecvStream) -> u32 {
    let id = self.next_id.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = mpsc::unbounded_channel::<Vec<u8>>();
    let remote = connection.remote_id().to_string();
    self.peers.lock().await.insert(
      id,
      Peer {
        outgoing: tx,
        connection: connection.clone(),
      },
    );
    self.sink.emit(frame(EventKind::Connected, id, remote.as_bytes()));

    tokio::spawn(write_loop(send, rx));
    let peers = self.peers.clone();
    let sink = self.sink.clone();
    tokio::spawn(async move {
      let reason = match read_loop(recv, id, sink.as_ref()).await {
        Ok(()) => String::new(),
        Err(e) => e.to_string(),
      };
      connection.close(0u32.into(), b"closed");
      peers.lock().await.remove(&id);
      sink.emit(frame(EventKind::Closed, id, reason.as_bytes()));
    });
    id
  }

  pub async fn send(&self, conn: u32, data: Vec<u8>) -> Result<()> {
    if data.len() > MAX_MESSAGE {
      bail!("message too large");
    }
    let peers = self.peers.lock().await;
    let peer = peers.get(&conn).ok_or_else(|| anyhow!("not connected"))?;
    peer.outgoing.send(data).map_err(|_| anyhow!("not connected"))
  }

  pub async fn disconnect(&self, conn: u32) {
    if let Some(peer) = self.peers.lock().await.remove(&conn) {
      peer.connection.close(0u32.into(), b"bye");
    }
  }

  pub async fn stop(&self) {
    let peers: Vec<Peer> = self.peers.lock().await.drain().map(|(_, p)| p).collect();
    for peer in peers {
      peer.connection.close(0u32.into(), b"bye");
    }
    self.endpoint.close().await;
  }
}

async fn write_loop(mut send: SendStream, mut rx: mpsc::UnboundedReceiver<Vec<u8>>) {
  while let Some(msg) = rx.recv().await {
    let len = (msg.len() as u32).to_be_bytes();
    if send.write_all(&len).await.is_err() || send.write_all(&msg).await.is_err() {
      break;
    }
  }
  let _ = send.finish();
}

async fn read_loop(mut recv: RecvStream, id: u32, sink: &dyn EventSink) -> Result<()> {
  loop {
    let mut len = [0u8; 4];
    if recv.read_exact(&mut len).await.is_err() {
      return Ok(()); // stream finished or connection gone
    }
    let len = u32::from_be_bytes(len) as usize;
    if len > MAX_MESSAGE {
      bail!("peer sent a message that is too large");
    }
    let mut buf = vec![0u8; len];
    recv.read_exact(&mut buf).await.map_err(|e| anyhow!("{e}"))?;
    sink.emit(frame(EventKind::Message, id, &buf));
  }
}

/// This device's identity, created once and kept in the app data folder.
pub fn load_or_create_secret(path: &std::path::Path) -> Result<SecretKey> {
  if let Ok(bytes) = std::fs::read(path) {
    if let Ok(arr) = <[u8; 32]>::try_from(bytes.as_slice()) {
      return Ok(SecretKey::from_bytes(&arr));
    }
  }
  let key = SecretKey::generate();
  if let Some(dir) = path.parent() {
    std::fs::create_dir_all(dir)?;
  }
  let tmp = path.with_extension("tmp");
  std::fs::write(&tmp, key.to_bytes())?;
  std::fs::rename(&tmp, path)?;
  Ok(key)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::Duration;

  async fn next(rx: &mut mpsc::UnboundedReceiver<Vec<u8>>) -> Vec<u8> {
    tokio::time::timeout(Duration::from_secs(20), rx.recv())
      .await
      .expect("timed out")
      .expect("closed")
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn two_nodes_exchange_messages() {
    exchange(NetMode::Local).await;
  }

  /// Uses the public n0 relays over the internet, so it only runs when asked:
  /// `cargo test -- --ignored` (CI does this on Windows, macOS and Linux).
  #[tokio::test(flavor = "multi_thread")]
  #[ignore]
  async fn two_nodes_exchange_messages_through_relay() {
    exchange(NetMode::RelayOnly).await;
  }

  async fn exchange(mode: NetMode) {
    let (tx_a, mut rx_a) = mpsc::unbounded_channel();
    let (tx_b, mut rx_b) = mpsc::unbounded_channel();
    let a = Node::start(SecretKey::generate(), Arc::new(tx_a), mode)
      .await
      .unwrap();
    let b = Node::start(SecretKey::generate(), Arc::new(tx_b), mode)
      .await
      .unwrap();

    let addr = b.addr_json(!matches!(mode, NetMode::Local)).await.unwrap();
    let conn_a = a.connect(&addr).await.unwrap();

    let connected_a = next(&mut rx_a).await;
    assert_eq!(connected_a[0], EventKind::Connected as u8);
    assert_eq!(&connected_a[5..], b.id().to_string().as_bytes());

    let connected_b = next(&mut rx_b).await;
    assert_eq!(connected_b[0], EventKind::Connected as u8);
    assert_eq!(&connected_b[5..], a.id().to_string().as_bytes());
    let conn_b = u32::from_be_bytes(connected_b[1..5].try_into().unwrap());

    a.send(conn_a, b"hello".to_vec()).await.unwrap();
    let big = vec![7u8; 3 * 1024 * 1024];
    a.send(conn_a, big.clone()).await.unwrap();
    let m1 = next(&mut rx_b).await;
    assert_eq!(m1[0], EventKind::Message as u8);
    assert_eq!(&m1[5..], b"hello");
    let m2 = next(&mut rx_b).await;
    assert_eq!(&m2[5..], &big[..]);

    b.send(conn_b, b"hi back".to_vec()).await.unwrap();
    let reply = next(&mut rx_a).await;
    assert_eq!(&reply[5..], b"hi back");

    a.disconnect(conn_a).await;
    let closed = next(&mut rx_b).await;
    assert_eq!(closed[0], EventKind::Closed as u8);

    a.stop().await;
    b.stop().await;
  }

  #[tokio::test]
  async fn rejects_oversized_messages() {
    let (tx, _rx) = mpsc::unbounded_channel();
    let a = Node::start(SecretKey::generate(), Arc::new(tx), NetMode::Local)
      .await
      .unwrap();
    assert!(a.send(1, vec![0; MAX_MESSAGE + 1]).await.is_err());
    a.stop().await;
  }

  #[test]
  fn secret_is_created_once() {
    let dir = std::env::temp_dir().join(format!("egd-collab-test-{}", std::process::id()));
    let path = dir.join("collab-key");
    let a = load_or_create_secret(&path).unwrap();
    let b = load_or_create_secret(&path).unwrap();
    assert_eq!(a.public(), b.public());
    let _ = std::fs::remove_dir_all(dir);
  }

  /// Cross-OS check: the CI workflow `cross-os.yml` runs this at the same time
  /// on Windows, macOS and Linux. Each runner derives every runner's identity
  /// from the run id, dials the others over the internet, and waits until it
  /// has heard from all of them.
  #[tokio::test(flavor = "multi_thread")]
  #[ignore]
  async fn cross_os_mesh() {
    let Ok(me) = std::env::var("EGD_MESH_SELF") else {
      eprintln!("EGD_MESH_SELF not set, skipping");
      return;
    };
    let run = std::env::var("EGD_MESH_RUN").unwrap_or_default();
    let all = ["linux", "windows", "macos"];
    let key = |name: &str| {
      use std::hash::{Hash, Hasher};
      let mut bytes = [0u8; 32];
      for (i, chunk) in bytes.chunks_mut(8).enumerate() {
        let mut h = std::collections::hash_map::DefaultHasher::new();
        (run.as_str(), name, i).hash(&mut h);
        chunk.copy_from_slice(&h.finish().to_le_bytes());
      }
      SecretKey::from_bytes(&bytes)
    };

    let (tx, mut rx) = mpsc::unbounded_channel();
    let node = Node::start(key(&me), Arc::new(tx), NetMode::Internet).await.unwrap();
    node.addr_json(true).await.unwrap();
    let others: Vec<String> = all.iter().filter(|n| **n != me).map(|n| key(n).public().to_string()).collect();
    let deadline = tokio::time::Instant::now() + Duration::from_secs(1500);

    let mut heard = std::collections::HashSet::new();
    let mut last_dial = tokio::time::Instant::now() - Duration::from_secs(60);
    while heard.len() < others.len() {
      assert!(tokio::time::Instant::now() < deadline, "only heard from {heard:?}");
      if last_dial.elapsed() > Duration::from_secs(20) {
        last_dial = tokio::time::Instant::now();
        for id in &others {
          if let Err(e) = node.connect(id).await {
            eprintln!("dial {id}: {e}");
          }
        }
      }
      let Ok(Some(event)) = tokio::time::timeout(Duration::from_secs(5), rx.recv()).await else {
        continue;
      };
      let conn = u32::from_be_bytes(event[1..5].try_into().unwrap());
      if event[0] == EventKind::Connected as u8 {
        let _ = node.send(conn, format!("hello from {me}").into_bytes()).await;
      } else if event[0] == EventKind::Message as u8 {
        let text = String::from_utf8_lossy(&event[5..]).to_string();
        eprintln!("{me} got: {text}");
        heard.insert(text);
      }
    }
    // Stay up a little so slower runners can still reach us.
    tokio::time::sleep(Duration::from_secs(30)).await;
    node.stop().await;
  }
}
