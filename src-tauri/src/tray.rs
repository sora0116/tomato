use serde::{Deserialize, Serialize};
use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  AppHandle, Manager, Wry,
};

const STATUS_ID: &str = "status";
const START_ID: &str = "start";
const PAUSE_RESUME_ID: &str = "pause_resume";
const SKIP_ID: &str = "skip";
const RESET_ID: &str = "reset";
const TOGGLE_WINDOW_ID: &str = "toggle_window";
const QUIT_ID: &str = "quit";

#[derive(Debug, Clone, Default)]
pub struct TrayPresentationState {
  pub status: TrayStatus,
  pub mode: TrayMode,
  pub remaining_label: String,
}

impl TrayPresentationState {
  pub fn from_payload(payload: &TrayStatePayload) -> Self {
    Self {
      status: payload.status.clone(),
      mode: payload.mode.clone(),
      remaining_label: payload.remaining_label.clone(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum TrayStatus {
  #[default]
  Idle,
  Running,
  Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum TrayMode {
  #[default]
  Focus,
  ShortBreak,
  LongBreak,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStatePayload {
  pub status: TrayStatus,
  pub mode: TrayMode,
  pub remaining_label: String,
  pub window_visible: bool,
}

#[derive(Debug, Clone, Copy)]
pub enum TrayAction {
  Start,
  Pause,
  Resume,
  Skip,
  Reset,
  ToggleWindow,
  Quit,
}

pub struct TrayController {
  status: MenuItem<Wry>,
  start: MenuItem<Wry>,
  pause_resume: MenuItem<Wry>,
  skip: MenuItem<Wry>,
  reset: MenuItem<Wry>,
  toggle: MenuItem<Wry>,
}

pub fn create_tray<F>(app: &AppHandle, on_action: F) -> Result<TrayController, tauri::Error>
where
  F: Fn(&AppHandle, TrayAction) + Send + Sync + 'static,
{
  let status_item = MenuItem::with_id(app, STATUS_ID, "Idle", false, None::<&str>)?;
  let start_item = MenuItem::with_id(app, START_ID, "Start", true, None::<&str>)?;
  let pause_resume_item = MenuItem::with_id(app, PAUSE_RESUME_ID, "Pause", false, None::<&str>)?;
  let skip_item = MenuItem::with_id(app, SKIP_ID, "Skip", false, None::<&str>)?;
  let reset_item = MenuItem::with_id(app, RESET_ID, "Reset", true, None::<&str>)?;
  let toggle_window_item =
    MenuItem::with_id(app, TOGGLE_WINDOW_ID, "Hide", true, None::<&str>)?;
  let quit_item = MenuItem::with_id(app, QUIT_ID, "Quit", true, None::<&str>)?;

  let menu = Menu::with_items(
    app,
    &[
      &status_item,
      &start_item,
      &pause_resume_item,
      &skip_item,
      &reset_item,
      &toggle_window_item,
      &quit_item,
    ],
  )?;

  let default_icon = app.default_window_icon().cloned();
  let mut builder = TrayIconBuilder::with_id("main")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(move |app_handle, event| match event.id.as_ref() {
      START_ID => on_action(app_handle, TrayAction::Start),
      PAUSE_RESUME_ID => {
        let tray_state = app_handle.state::<crate::AppState>();
        if let Ok(guard) = tray_state.tray_state.lock() {
          match guard.status {
            TrayStatus::Paused => on_action(app_handle, TrayAction::Resume),
            TrayStatus::Running => on_action(app_handle, TrayAction::Pause),
            TrayStatus::Idle => {}
          }
        };
      }
      SKIP_ID => on_action(app_handle, TrayAction::Skip),
      RESET_ID => on_action(app_handle, TrayAction::Reset),
      TOGGLE_WINDOW_ID => on_action(app_handle, TrayAction::ToggleWindow),
      QUIT_ID => on_action(app_handle, TrayAction::Quit),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        let _ = toggle_window_visibility(app);
      }
    });

  if let Some(icon) = default_icon {
    builder = builder.icon(icon);
  }

  builder.build(app)?;

  let controller = TrayController {
    status: status_item,
    start: start_item,
    pause_resume: pause_resume_item,
    skip: skip_item,
    reset: reset_item,
    toggle: toggle_window_item,
  };

  apply_tray_state(
    &controller,
    &TrayStatePayload {
      status: TrayStatus::Idle,
      mode: TrayMode::Focus,
      remaining_label: String::new(),
      window_visible: true,
    },
  )
  .map_err(|error| tauri::Error::Anyhow(anyhow::anyhow!(error)))?;

  Ok(controller)
}

pub fn apply_tray_state(controller: &TrayController, payload: &TrayStatePayload) -> Result<(), String> {
  controller
    .status
    .set_text(status_label(payload))
    .map_err(|error| error.to_string())?;
  controller
    .start
    .set_enabled(matches!(payload.status, TrayStatus::Idle))
    .map_err(|error| error.to_string())?;
  controller
    .pause_resume
    .set_text(if matches!(payload.status, TrayStatus::Paused) {
      "Resume"
    } else {
      "Pause"
    })
    .map_err(|error| error.to_string())?;
  controller
    .pause_resume
    .set_enabled(!matches!(payload.status, TrayStatus::Idle))
    .map_err(|error| error.to_string())?;
  controller
    .skip
    .set_enabled(!matches!(payload.status, TrayStatus::Idle))
    .map_err(|error| error.to_string())?;
  controller
    .reset
    .set_enabled(true)
    .map_err(|error| error.to_string())?;
  controller
    .toggle
    .set_text(if payload.window_visible { "Hide" } else { "Show" })
    .map_err(|error| error.to_string())?;
  Ok(())
}

fn status_label(payload: &TrayStatePayload) -> String {
  match payload.status {
    TrayStatus::Idle => "Idle".to_string(),
    TrayStatus::Paused => "Paused".to_string(),
    TrayStatus::Running => {
      let prefix = match payload.mode {
        TrayMode::Focus => "Focus",
        TrayMode::ShortBreak | TrayMode::LongBreak => "Break",
      };
      format!("{prefix} {}", payload.remaining_label)
    }
  }
}

pub fn show_main_window(app: &AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "main window not found".to_string())?;
  window.unminimize().map_err(|error| error.to_string())?;
  window.show().map_err(|error| error.to_string())?;
  window.set_focus().map_err(|error| error.to_string())?;
  Ok(())
}

pub fn toggle_window_visibility(app: &AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "main window not found".to_string())?;
  let is_visible = window.is_visible().map_err(|error| error.to_string())?;

  if is_visible {
    window.hide().map_err(|error| error.to_string())?;
  } else {
    show_main_window(app)?;
  }

  let tray_state = app
    .state::<crate::AppState>()
    .tray_state
    .lock()
    .map_err(|_| "tray state lock poisoned".to_string())?
    .clone();
  update_window_visibility(app, !is_visible, tray_state)
}

pub fn update_window_visibility(
  app: &AppHandle,
  window_visible: bool,
  tray_state: TrayPresentationState,
) -> Result<(), String> {
  let state = app.state::<crate::AppState>();
  let guard = state
    .tray
    .lock()
    .map_err(|_| "tray lock poisoned".to_string())?;
  let controller = guard
    .as_ref()
    .ok_or_else(|| "tray not initialized".to_string())?;

  apply_tray_state(
    controller,
    &TrayStatePayload {
      status: tray_state.status,
      mode: tray_state.mode,
      remaining_label: tray_state.remaining_label,
      window_visible,
    },
  )
}
