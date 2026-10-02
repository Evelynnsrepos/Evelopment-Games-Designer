mod llm;
mod plugins;
mod spell;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .manage(llm::LlmState::default())
    .invoke_handler(tauri::generate_handler![
      spell::spell_check,
      spell::spell_suggest,
      llm::llm_status,
      llm::llm_install,
      llm::llm_remove,
      llm::llm_suggest,
      plugins::plugin_download
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
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      if let tauri::RunEvent::Exit = event {
        llm::stop(app);
      }
    });
}
