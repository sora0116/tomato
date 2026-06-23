use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub fn show_notification(app: &AppHandle, title: &str, body: &str, _sound_enabled: bool) {
  let notification = app.notification().builder().title(title).body(body);
  let _ = notification.show();
}
