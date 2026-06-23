import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  clampConfig,
  createInitialTimerState,
  type AppConfig,
  type ConfigLoadResponse,
  type PresetField,
  type TimerState,
} from "./config";
import { BrownNoiseEngine } from "./audio/brownNoise";
import { notifyTransition } from "./notifications";
import {
  formatRemaining,
  getDurationMs,
  getRemainingMs,
  pauseTimer,
  resetTimer,
  resumeTimer,
  skipTimer,
  startTimer,
  tickTimer,
} from "./timer";
import { updateTray } from "./tray";

export type PomodoroViewState = {
  config: AppConfig;
  configPath: string;
  timer: TimerState;
  remainingLabel: string;
  modeLabel: string;
  notice: string | null;
};

type TrayActionEvent = {
  action: "start" | "pause" | "resume" | "skip" | "reset";
};

const defaultConfig: AppConfig = clampConfig({
  activePreset: "default",
  presets: {
    default: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      longBreakInterval: 4,
    },
    deep_work: {
      focusMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 30,
      longBreakInterval: 3,
    },
  },
  audio: {
    brownNoiseEnabled: true,
    volume: 0.18,
    fadeInMs: 500,
  },
  notification: {
    desktopNotification: true,
    soundEnabled: true,
  },
});

export function createPomodoroController() {
  const audio = new BrownNoiseEngine();
  let config = defaultConfig;
  let timer = createInitialTimerState(config);
  let configPath = "";
  let notice: string | null = null;
  let windowVisible = true;
  let subscribers = new Set<(state: PomodoroViewState) => void>();
  let tickHandle: number | undefined;

  audio.setVolume(config.audio.volume);
  audio.setFadeInMs(config.audio.fadeInMs);

  const notify = () => {
    const snapshot = api.getSnapshot();
    for (const subscriber of subscribers) {
      subscriber(snapshot);
    }
  };

  const syncTray = async () => {
    try {
      await updateTray({
        status: timer.status,
        mode: timer.mode,
        remainingLabel:
          timer.status === "idle"
            ? formatRemaining(getDurationMs(config, config.activePreset, timer.mode))
            : formatRemaining(getRemainingMs(timer)),
        windowVisible,
      });
    } catch (error) {
      console.error("tray update failed", error);
    }
  };

  const syncAudio = async () => {
    audio.setVolume(config.audio.volume);
    audio.setFadeInMs(config.audio.fadeInMs);

    if (
      config.audio.brownNoiseEnabled &&
      timer.status === "running" &&
      timer.mode === "focus"
    ) {
      try {
        await audio.start();
      } catch (error) {
        console.error("audio start failed", error);
      }
    } else {
      audio.stop();
    }
  };

  const syncDerived = async () => {
    await syncAudio();
    await syncTray();
    notify();
  };

  const startTicker = () => {
    if (tickHandle !== undefined) {
      return;
    }

    tickHandle = window.setInterval(async () => {
      const transition = tickTimer(timer, config, Date.now());
      timer = transition.nextState;
      if (transition.notification) {
        await notifyTransition(
          transition.notification.title,
          transition.notification.body,
          config.notification.desktopNotification,
          config.notification.soundEnabled,
        );
      }
      await syncDerived();
    }, 1_000);
  };

  const saveConfig = async () => {
    const saved = await invoke<AppConfig>("save_config", { config });
    config = clampConfig(saved);
    if (timer.status === "idle") {
      timer = {
        ...timer,
        presetName: config.activePreset,
      };
    }
  };

  const setConfig = async (nextConfig: AppConfig) => {
    config = clampConfig(nextConfig);
    await saveConfig();
    await syncDerived();
  };

  const load = async () => {
    try {
      const response = await invoke<ConfigLoadResponse>("load_config");
      config = clampConfig(response.config);
      configPath = response.configPath;
      timer = createInitialTimerState(config);
      if (response.recoveredFromCorruption) {
        notice = response.backupPath
          ? `Config was reset after a parse failure. Backup: ${response.backupPath}`
          : "Config was reset after a parse failure.";
      }
      audio.setVolume(config.audio.volume);
      audio.setFadeInMs(config.audio.fadeInMs);
    } finally {
      await syncDerived();
    }
  };

  const handleTrayAction = async (action: TrayActionEvent["action"]) => {
    switch (action) {
      case "start":
        await api.start();
        break;
      case "pause":
        await api.pause();
        break;
      case "resume":
        await api.resume();
        break;
      case "skip":
        await api.skip();
        break;
      case "reset":
        await api.reset();
        break;
    }
  };

  const api = {
    getSnapshot(): PomodoroViewState {
      const remainingMs =
        timer.status === "idle"
          ? getDurationMs(config, config.activePreset, timer.mode)
          : getRemainingMs(timer);
      return {
        config,
        configPath,
        timer,
        remainingLabel: formatRemaining(remainingMs),
        modeLabel:
          timer.mode === "focus"
            ? "Focus"
            : timer.mode === "short_break"
              ? "Short Break"
              : "Long Break",
        notice,
      };
    },

    subscribe(subscriber: (state: PomodoroViewState) => void) {
      subscribers.add(subscriber);
      subscriber(api.getSnapshot());

      let unlistenWindow: (() => void) | undefined;
      let unlistenTray: (() => void) | undefined;

      void Promise.all([
        getCurrentWindow().onFocusChanged(async ({ payload }) => {
          windowVisible = payload;
          await syncTray();
        }),
        listen<TrayActionEvent>("tray-action", async (event) => {
          await handleTrayAction(event.payload.action);
        }),
        load(),
      ]).then(([focusUnlisten, trayUnlisten]) => {
        unlistenWindow = focusUnlisten;
        unlistenTray = trayUnlisten;
      });

      startTicker();

      return () => {
        subscribers.delete(subscriber);
        unlistenWindow?.();
        unlistenTray?.();
      };
    },

    async start() {
      await audio.prepare();
      timer = startTimer(timer, config);
      await syncDerived();
    },

    async pause() {
      timer = pauseTimer(timer);
      await syncDerived();
    },

    async resume() {
      await audio.prepare();
      timer = resumeTimer(timer);
      await syncDerived();
    },

    async skip() {
      timer = skipTimer(timer, config);
      await syncDerived();
    },

    async reset() {
      timer = resetTimer(timer, config);
      await syncDerived();
    },

    async selectPreset(presetName: string) {
      if (!config.presets[presetName]) {
        return;
      }

      await setConfig({
        ...config,
        activePreset: presetName,
      });
    },

    async setBrownNoiseEnabled(enabled: boolean) {
      await setConfig({
        ...config,
        audio: {
          ...config.audio,
          brownNoiseEnabled: enabled,
        },
      });
    },

    async setVolume(volume: number) {
      await setConfig({
        ...config,
        audio: {
          ...config.audio,
          volume,
        },
      });
    },

    async setFadeInMs(fadeInMs: number) {
      await setConfig({
        ...config,
        audio: {
          ...config.audio,
          fadeInMs,
        },
      });
    },

    async setDesktopNotifications(enabled: boolean) {
      await setConfig({
        ...config,
        notification: {
          ...config.notification,
          desktopNotification: enabled,
        },
      });
    },

    async setNotificationSound(enabled: boolean) {
      await setConfig({
        ...config,
        notification: {
          ...config.notification,
          soundEnabled: enabled,
        },
      });
    },

    async addPreset() {
      let index = 2;
      let name = `preset_${index}`;
      while (config.presets[name]) {
        index += 1;
        name = `preset_${index}`;
      }
      await setConfig({
        ...config,
        presets: {
          ...config.presets,
          [name]: { ...config.presets[config.activePreset]! },
        },
      });
    },

    async deletePreset(presetName: string) {
      if (Object.keys(config.presets).length <= 1 || !config.presets[presetName]) {
        return;
      }

      const nextPresets = { ...config.presets };
      delete nextPresets[presetName];
      const nextActivePreset =
        config.activePreset === presetName ? Object.keys(nextPresets)[0]! : config.activePreset;
      await setConfig({
        ...config,
        activePreset: nextActivePreset,
        presets: nextPresets,
      });
    },

    async renamePreset(oldName: string, newName: string) {
      const sanitized = newName.trim().replace(/\s+/g, "_");
      if (!sanitized || sanitized === oldName || config.presets[sanitized]) {
        return;
      }

      const nextPresets: Record<string, AppConfig["presets"][string]> = {};
      for (const [name, preset] of Object.entries(config.presets)) {
        nextPresets[name === oldName ? sanitized : name] = preset;
      }

      await setConfig({
        ...config,
        activePreset: config.activePreset === oldName ? sanitized : config.activePreset,
        presets: nextPresets,
      });
    },

    async updatePreset(presetName: string, field: PresetField, value: number) {
      const preset = config.presets[presetName];
      if (!preset) {
        return;
      }

      await setConfig({
        ...config,
        presets: {
          ...config.presets,
          [presetName]: {
            ...preset,
            [field]: Math.max(1, Math.round(value)),
          },
        },
      });
    },
  };

  return api;
}
