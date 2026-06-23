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
