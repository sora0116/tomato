use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::{
  config::{AppConfig, ConfigLoadResponse},
  notification,
  tray::{self, TrayStatePayload},
  AppState,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayActionPayload {
  pub action: String,
}

#[tauri::command]
pub fn load_config(state: State<'_, AppState>) -> Result<ConfigLoadResponse, String> {
  let manager = state.config.lock().map_err(|_| "config lock poisoned")?;
  Ok(ConfigLoadResponse {
    config: manager.config().clone(),
    config_path: manager.path().display().to_string(),
    recovered_from_corruption: state.config_load_info.recovered_from_corruption,
    backup_path: state
      .config_load_info
      .backup_path
      .as_ref()
      .map(|path| path.display().to_string()),
  })
}

#[tauri::command]
pub fn save_config(state: State<'_, AppState>, config: AppConfig) -> Result<AppConfig, String> {
  let mut manager = state.config.lock().map_err(|_| "config lock poisoned")?;
  manager.save(config)
}

#[tauri::command]
pub fn update_tray_state(
  app: AppHandle,
  state: State<'_, AppState>,
  payload: TrayStatePayload,
) -> Result<(), String> {
  {
    let mut tray_state = state.tray_state.lock().map_err(|_| "tray state lock poisoned")?;
    *tray_state = tray::TrayPresentationState::from_payload(&payload);
  }

  let guard = state.tray.lock().map_err(|_| "tray lock poisoned")?;
  let controller = guard
    .as_ref()
    .ok_or_else(|| "tray not initialized".to_string())?;
  tray::apply_tray_state(controller, &payload)?;

  if let Some(window) = app.get_webview_window("main") {
    let is_visible = window.is_visible().map_err(|error| error.to_string())?;
    if is_visible != payload.window_visible {
      tray::update_window_visibility(&app, is_visible, tray::TrayPresentationState::from_payload(&payload))?;
    }
  }

  Ok(())
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
  tray::show_main_window(&app)
}

#[tauri::command]
pub fn hide_main_window(app: AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "main window not found".to_string())?;
  window.hide().map_err(|error| error.to_string())
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationPayload {
  pub title: String,
  pub body: String,
  pub enabled: bool,
  pub sound_enabled: bool,
}

#[tauri::command]
pub fn notify_transition(app: AppHandle, payload: NotificationPayload) -> Result<(), String> {
  if payload.enabled {
    notification::show_notification(&app, &payload.title, &payload.body, payload.sound_enabled);
  }
  Ok(())
}
