mod commands;
mod config;
mod notification;
mod tray;

use std::sync::Mutex;
use std::panic::{catch_unwind, AssertUnwindSafe};

use config::{ConfigLoadInfo, ConfigManager};
use tauri::{AppHandle, Emitter, Manager, Window, WindowEvent};
use tray::{create_tray, TrayPresentationState};

pub struct AppState {
  config: Mutex<ConfigManager>,
  config_load_info: ConfigLoadInfo,
  tray_state: Mutex<TrayPresentationState>,
  tray: Mutex<Option<tray::TrayController>>,
}

impl AppState {
  fn new() -> Self {
    let (config, load_info) = ConfigManager::load_or_initialize();
    Self {
      config: Mutex::new(config),
      config_load_info: load_info,
      tray_state: Mutex::new(TrayPresentationState::default()),
      tray: Mutex::new(None),
    }
  }
}

fn emit_tray_action(app: &AppHandle, action: &str) {
  let _ = app.emit("tray-action", commands::TrayActionPayload {
    action: action.to_string(),
  });
}

fn handle_window_event(window: &Window, event: &WindowEvent) {
  if let WindowEvent::CloseRequested { api, .. } = event {
    api.prevent_close();
    let _ = window.hide();
    let app = window.app_handle();
    if let Ok(payload) = app.state::<AppState>().tray_state.lock().map(|guard| guard.clone()) {
      let _ = tray::update_window_visibility(app, false, payload);
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .manage(AppState::new())
    .setup(|app| {
      let tray_result = catch_unwind(AssertUnwindSafe(|| {
        create_tray(app.handle(), |app_handle, action| match action {
          tray::TrayAction::Start => emit_tray_action(app_handle, "start"),
          tray::TrayAction::Pause => emit_tray_action(app_handle, "pause"),
          tray::TrayAction::Resume => emit_tray_action(app_handle, "resume"),
          tray::TrayAction::Skip => emit_tray_action(app_handle, "skip"),
          tray::TrayAction::Reset => emit_tray_action(app_handle, "reset"),
          tray::TrayAction::ToggleWindow => {
            let _ = tray::toggle_window_visibility(app_handle);
          }
          tray::TrayAction::Quit => app_handle.exit(0),
        })
      }));

      match tray_result {
        Ok(Ok(controller)) => {
          if let Ok(mut guard) = app.state::<AppState>().tray.lock() {
            *guard = Some(controller);
          }
        }
        Ok(Err(error)) => {
          eprintln!("tray initialization failed: {error}");
        }
        Err(_) => {
          eprintln!(
            "tray initialization panicked; continuing without tray. Install libayatana-appindicator to enable tray support."
          );
        }
      }

      Ok(())
    })
    .on_window_event(handle_window_event)
    .invoke_handler(tauri::generate_handler![
      commands::load_config,
      commands::save_config,
      commands::update_tray_state,
      commands::show_main_window,
      commands::hide_main_window,
      commands::notify_transition
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
