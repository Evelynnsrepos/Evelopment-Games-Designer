mod collab;
mod collab_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .manage(collab_commands::CollabState::default())
    .invoke_handler(tauri::generate_handler![
      collab_commands::collab_start,
      collab_commands::collab_addr,
      collab_commands::collab_connect,
      collab_commands::collab_send,
      collab_commands::collab_disconnect,
      collab_commands::collab_stop,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
