use std::{
  collections::BTreeMap,
  env,
  fs,
  path::{Path, PathBuf},
  time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

const APP_DIR_NAME: &str = "pomodoro-timer";
const CONFIG_FILE_NAME: &str = "config.toml";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub struct Preset {
  pub focus_minutes: u32,
  pub short_break_minutes: u32,
  pub long_break_minutes: u32,
  pub long_break_interval: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct AudioConfig {
  pub brown_noise_enabled: bool,
  pub volume: f64,
  pub fade_in_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub struct NotificationConfig {
  pub desktop_notification: bool,
  pub sound_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct AppConfig {
  pub active_preset: String,
  pub presets: BTreeMap<String, Preset>,
  pub audio: AudioConfig,
  pub notification: NotificationConfig,
}

impl Default for AppConfig {
  fn default() -> Self {
    let mut presets = BTreeMap::new();
    presets.insert(
      "default".to_string(),
      Preset {
        focus_minutes: 25,
        short_break_minutes: 5,
        long_break_minutes: 15,
        long_break_interval: 4,
      },
    );
    presets.insert(
      "deep_work".to_string(),
      Preset {
        focus_minutes: 50,
        short_break_minutes: 10,
        long_break_minutes: 30,
        long_break_interval: 3,
      },
    );

    Self {
      active_preset: "default".to_string(),
      presets,
      audio: AudioConfig {
        brown_noise_enabled: true,
        volume: 0.18,
        fade_in_ms: 500,
      },
      notification: NotificationConfig {
        desktop_notification: true,
        sound_enabled: true,
      },
    }
  }
}

impl AppConfig {
  pub fn normalize(mut self) -> Self {
    self.audio.volume = self.audio.volume.clamp(0.0, 1.0);

    self.presets.retain(|name, preset| {
      !name.trim().is_empty()
        && preset.focus_minutes > 0
        && preset.short_break_minutes > 0
        && preset.long_break_minutes > 0
        && preset.long_break_interval > 0
    });

    if self.presets.is_empty() {
      return Self::default();
    }

    if !self.presets.contains_key(&self.active_preset) {
      if let Some(first_key) = self.presets.keys().next().cloned() {
        self.active_preset = first_key;
      }
    }

    self
  }
}

#[derive(Debug, Clone, Default)]
pub struct ConfigLoadInfo {
  pub recovered_from_corruption: bool,
  pub backup_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigLoadResponse {
  pub config: AppConfig,
  pub config_path: String,
  pub recovered_from_corruption: bool,
  pub backup_path: Option<String>,
}

pub struct ConfigManager {
  path: PathBuf,
  config: AppConfig,
}

impl ConfigManager {
  pub fn load_or_initialize() -> (Self, ConfigLoadInfo) {
    let path = config_path();
    if let Some(parent) = path.parent() {
      let _ = fs::create_dir_all(parent);
    }

    match fs::read_to_string(&path) {
      Ok(contents) => match toml::from_str::<AppConfig>(&contents) {
        Ok(config) => (
          Self {
            path,
            config: config.normalize(),
          },
          ConfigLoadInfo::default(),
        ),
        Err(_) => {
          let backup_path = backup_corrupted_config(&path);
          let default_config = AppConfig::default();
          let _ = write_config_file(&path, &default_config);
          (
            Self {
              path,
              config: default_config,
            },
            ConfigLoadInfo {
              recovered_from_corruption: true,
              backup_path,
            },
          )
        }
      },
      Err(_) => {
        let default_config = AppConfig::default();
        let _ = write_config_file(&path, &default_config);
        (
          Self {
            path,
            config: default_config,
          },
          ConfigLoadInfo::default(),
        )
      }
    }
  }

  pub fn path(&self) -> &Path {
    &self.path
  }

  pub fn config(&self) -> &AppConfig {
    &self.config
  }

  pub fn save(&mut self, config: AppConfig) -> Result<AppConfig, String> {
    let normalized = config.normalize();
    write_config_file(&self.path, &normalized)?;
    self.config = normalized.clone();
    Ok(normalized)
  }
}

fn write_config_file(path: &Path, config: &AppConfig) -> Result<(), String> {
  let serialized = toml::to_string_pretty(config).map_err(|error| error.to_string())?;
  fs::write(path, serialized).map_err(|error| error.to_string())
}

fn backup_corrupted_config(path: &Path) -> Option<PathBuf> {
  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .ok()?
    .as_secs();
  let backup_path = path.with_file_name(format!("{CONFIG_FILE_NAME}.bak-{timestamp}"));
  fs::rename(path, &backup_path).ok()?;
  Some(backup_path)
}

pub fn config_path() -> PathBuf {
  let base = env::var_os("XDG_CONFIG_HOME")
    .map(PathBuf::from)
    .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
    .unwrap_or_else(|| PathBuf::from("."));
  base.join(APP_DIR_NAME).join(CONFIG_FILE_NAME)
}

#[cfg(test)]
mod tests {
  use super::*;
  use tempfile::tempdir;

  fn write_temp_config(path: &Path, contents: &str) {
    let parent = path.parent().expect("config dir");
    fs::create_dir_all(parent).expect("create config dir");
    fs::write(path, contents).expect("write config");
  }

  #[test]
  fn normalizes_invalid_active_preset() {
    let config = AppConfig {
      active_preset: "missing".to_string(),
      ..AppConfig::default()
    };
    let normalized = config.normalize();
    assert!(normalized.presets.contains_key(&normalized.active_preset));
  }

  #[test]
  fn writes_and_reads_config() {
    let dir = tempdir().expect("temp dir");
    let path = dir.path().join("config.toml");
    let config = AppConfig::default();
    write_config_file(&path, &config).expect("write config");
    let loaded = toml::from_str::<AppConfig>(&fs::read_to_string(&path).expect("read config"))
      .expect("parse config");
    assert_eq!(loaded, config);
  }

  #[test]
  fn recovers_from_corrupted_config() {
    let dir = tempdir().expect("temp dir");
    let xdg = dir.path().join("xdg");
    let path = xdg.join(APP_DIR_NAME).join(CONFIG_FILE_NAME);
    write_temp_config(&path, "not = [valid");
    unsafe {
      env::set_var("XDG_CONFIG_HOME", &xdg);
    }

    let (manager, info) = ConfigManager::load_or_initialize();
    assert!(info.recovered_from_corruption);
    assert!(info.backup_path.is_some());
    assert_eq!(manager.config(), &AppConfig::default());
  }
}
