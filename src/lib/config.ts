export type TimerMode = "focus" | "short_break" | "long_break";
export type TimerStatus = "idle" | "running" | "paused";

export type TimerState = {
  mode: TimerMode;
  status: TimerStatus;
  presetName: string;
  completedFocusCount: number;
  endsAtMs: number | null;
  pausedRemainingMs: number | null;
};

export type PresetConfig = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
};

export type AudioConfig = {
  brownNoiseEnabled: boolean;
  volume: number;
  fadeInMs: number;
};

export type NotificationConfig = {
  desktopNotification: boolean;
  soundEnabled: boolean;
};

export type AppConfig = {
  activePreset: string;
  presets: Record<string, PresetConfig>;
  audio: AudioConfig;
  notification: NotificationConfig;
};

export type ConfigLoadResponse = {
  config: AppConfig;
  configPath: string;
  recoveredFromCorruption: boolean;
  backupPath: string | null;
};

type WirePresetConfig = {
  focus_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  long_break_interval: number;
};

type WireAudioConfig = {
  brown_noise_enabled: boolean;
  volume: number;
  fade_in_ms: number;
};

type WireNotificationConfig = {
  desktop_notification: boolean;
  sound_enabled: boolean;
};

type WireAppConfig = {
  active_preset: string;
  presets: Record<string, WirePresetConfig>;
  audio: WireAudioConfig;
  notification: WireNotificationConfig;
};

export type PresetField = keyof PresetConfig;

export function createInitialTimerState(config: AppConfig): TimerState {
  return {
    mode: "focus",
    status: "idle",
    presetName: config.activePreset,
    completedFocusCount: 0,
    endsAtMs: null,
    pausedRemainingMs: null,
  };
}

export function clampConfig(config: AppConfig): AppConfig {
  const presetEntries = Object.entries(config.presets).filter(([name]) => name.trim().length > 0);
  const presets =
    presetEntries.length > 0
      ? Object.fromEntries(
          presetEntries.map(([name, preset]) => [
            name,
            {
              focusMinutes: Math.max(1, Math.round(preset.focusMinutes)),
              shortBreakMinutes: Math.max(1, Math.round(preset.shortBreakMinutes)),
              longBreakMinutes: Math.max(1, Math.round(preset.longBreakMinutes)),
              longBreakInterval: Math.max(1, Math.round(preset.longBreakInterval)),
            },
          ]),
        )
      : {
          default: {
            focusMinutes: 25,
            shortBreakMinutes: 5,
            longBreakMinutes: 15,
            longBreakInterval: 4,
          },
        };

  const activePreset = presets[config.activePreset] ? config.activePreset : Object.keys(presets)[0]!;

  return {
    activePreset,
    presets,
    audio: {
      brownNoiseEnabled: config.audio.brownNoiseEnabled,
      volume: Math.min(1, Math.max(0, config.audio.volume)),
      fadeInMs: Math.max(0, Math.round(config.audio.fadeInMs)),
    },
    notification: {
      desktopNotification: config.notification.desktopNotification,
      soundEnabled: config.notification.soundEnabled,
    },
  };
}

export function fromWireConfig(config: WireAppConfig | AppConfig): AppConfig {
  if ("activePreset" in config) {
    return clampConfig(config);
  }

  return clampConfig({
    activePreset: config.active_preset,
    presets: Object.fromEntries(
      Object.entries(config.presets).map(([name, preset]) => [
        name,
        {
          focusMinutes: preset.focus_minutes,
          shortBreakMinutes: preset.short_break_minutes,
          longBreakMinutes: preset.long_break_minutes,
          longBreakInterval: preset.long_break_interval,
        },
      ]),
    ),
    audio: {
      brownNoiseEnabled: config.audio.brown_noise_enabled,
      volume: config.audio.volume,
      fadeInMs: config.audio.fade_in_ms,
    },
    notification: {
      desktopNotification: config.notification.desktop_notification,
      soundEnabled: config.notification.sound_enabled,
    },
  });
}

export function toWireConfig(config: AppConfig): WireAppConfig {
  return {
    active_preset: config.activePreset,
    presets: Object.fromEntries(
      Object.entries(config.presets).map(([name, preset]) => [
        name,
        {
          focus_minutes: preset.focusMinutes,
          short_break_minutes: preset.shortBreakMinutes,
          long_break_minutes: preset.longBreakMinutes,
          long_break_interval: preset.longBreakInterval,
        },
      ]),
    ),
    audio: {
      brown_noise_enabled: config.audio.brownNoiseEnabled,
      volume: config.audio.volume,
      fade_in_ms: config.audio.fadeInMs,
    },
    notification: {
      desktop_notification: config.notification.desktopNotification,
      sound_enabled: config.notification.soundEnabled,
    },
  };
}
