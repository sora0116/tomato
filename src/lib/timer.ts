import type { AppConfig, TimerMode, TimerState } from "./config";

export type TransitionResult = {
  nextState: TimerState;
  notification?: {
    title: string;
    body: string;
  };
};

export function getPreset(config: AppConfig, presetName: string) {
  return config.presets[presetName] ?? config.presets[config.activePreset];
}

export function getDurationMs(config: AppConfig, presetName: string, mode: TimerMode): number {
  const preset = getPreset(config, presetName);
  switch (mode) {
    case "focus":
      return preset.focusMinutes * 60_000;
    case "short_break":
      return preset.shortBreakMinutes * 60_000;
    case "long_break":
      return preset.longBreakMinutes * 60_000;
  }
}

export function getRemainingMs(state: TimerState, now = Date.now()): number {
  if (state.status === "paused") {
    return state.pausedRemainingMs ?? 0;
  }

  if (state.status === "running" && state.endsAtMs !== null) {
    return Math.max(0, state.endsAtMs - now);
  }

  return 0;
}

export function startTimer(state: TimerState, config: AppConfig, now = Date.now()): TimerState {
  const durationMs = getDurationMs(config, config.activePreset, state.mode);
  return {
    ...state,
    status: "running",
    presetName: config.activePreset,
    endsAtMs: now + durationMs,
    pausedRemainingMs: null,
  };
}

export function pauseTimer(state: TimerState, now = Date.now()): TimerState {
  if (state.status !== "running" || state.endsAtMs === null) {
    return state;
  }

  return {
    ...state,
    status: "paused",
    pausedRemainingMs: Math.max(0, state.endsAtMs - now),
    endsAtMs: null,
  };
}

export function resumeTimer(state: TimerState, now = Date.now()): TimerState {
  if (state.status !== "paused" || state.pausedRemainingMs === null) {
    return state;
  }

  return {
    ...state,
    status: "running",
    endsAtMs: now + state.pausedRemainingMs,
    pausedRemainingMs: null,
  };
}

export function resetTimer(state: TimerState, config: AppConfig): TimerState {
  return {
    ...state,
    status: "idle",
    presetName: config.activePreset,
    completedFocusCount: 0,
    endsAtMs: null,
    pausedRemainingMs: null,
  };
}

export function skipTimer(state: TimerState, config: AppConfig, now = Date.now()): TimerState {
  if (state.status === "idle") {
    return state;
  }

  return transitionToNext(state, config, now, false).nextState;
}

export function tickTimer(state: TimerState, config: AppConfig, now = Date.now()): TransitionResult {
  if (state.status !== "running" || state.endsAtMs === null || state.endsAtMs > now) {
    return { nextState: state };
  }

  let current = state;
  let lastNotification: TransitionResult["notification"];
  let guard = 0;

  while (current.status === "running" && current.endsAtMs !== null && current.endsAtMs <= now && guard < 8) {
    const transition = transitionToNext(current, config, current.endsAtMs, true);
    current = transition.nextState;
    lastNotification = transition.notification;
    guard += 1;
  }

  return {
    nextState: current,
    notification: lastNotification,
  };
}

function transitionToNext(
  state: TimerState,
  config: AppConfig,
  startAtMs: number,
  completedNaturally: boolean,
): TransitionResult {
  const sessionPresetName = state.presetName;
  let completedFocusCount = state.completedFocusCount;
  let nextMode: TimerMode;
  let notification: TransitionResult["notification"];

  if (state.mode === "focus") {
    const interval = getPreset(config, sessionPresetName).longBreakInterval;
    if (completedNaturally) {
      completedFocusCount += 1;
      const longBreak = completedFocusCount % interval === 0;
      nextMode = longBreak ? "long_break" : "short_break";
      notification = {
        title: "Pomodoro Timer",
        body: longBreak
          ? "Focus cycle complete. Starting long break."
          : "Focus complete. Starting short break.",
      };
    } else {
      nextMode = "short_break";
    }
  } else {
    nextMode = "focus";
    if (completedNaturally) {
      notification = {
        title: "Pomodoro Timer",
        body: "Break complete. Starting focus session.",
      };
    }
  }

  const nextPresetName = config.activePreset;
  const durationMs = getDurationMs(config, nextPresetName, nextMode);

  return {
    nextState: {
      mode: nextMode,
      status: "running",
      presetName: nextPresetName,
      completedFocusCount,
      endsAtMs: startAtMs + durationMs,
      pausedRemainingMs: null,
    },
    notification,
  };
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
