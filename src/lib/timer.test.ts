import { describe, expect, it } from "vitest";
import { createInitialTimerState, type AppConfig } from "./config";
import {
  getDurationMs,
  pauseTimer,
  resetTimer,
  resumeTimer,
  skipTimer,
  startTimer,
  tickTimer,
} from "./timer";

const config: AppConfig = {
  activePreset: "default",
  presets: {
    default: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      longBreakInterval: 2,
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
};

describe("timer state machine", () => {
  it("starts focus sessions using absolute end time", () => {
    const state = createInitialTimerState(config);
    const started = startTimer(state, config, 1_000);
    expect(started.endsAtMs).toBe(1_000 + getDurationMs(config, "default", "focus"));
  });

  it("pauses and resumes without losing remaining time", () => {
    const started = startTimer(createInitialTimerState(config), config, 2_000);
    const paused = pauseTimer(started, 7_000);
    const resumed = resumeTimer(paused, 10_000);

    expect(paused.status).toBe("paused");
    expect(paused.pausedRemainingMs).toBe(started.endsAtMs! - 7_000);
    expect(resumed.endsAtMs).toBe(10_000 + paused.pausedRemainingMs!);
  });

  it("transitions to long break after the configured interval", () => {
    let state = startTimer(createInitialTimerState(config), config, 0);
    state = tickTimer(state, config, state.endsAtMs!).nextState;
    expect(state.mode).toBe("short_break");
    state = tickTimer(state, config, state.endsAtMs!).nextState;
    expect(state.mode).toBe("focus");
    state = tickTimer(state, config, state.endsAtMs!).nextState;
    expect(state.mode).toBe("long_break");
  });

  it("skip does not increment completed focus count", () => {
    const started = startTimer(createInitialTimerState(config), config, 0);
    const skipped = skipTimer(started, config, 5_000);
    expect(skipped.mode).toBe("short_break");
    expect(skipped.completedFocusCount).toBe(0);
  });

  it("reset returns to idle with a cleared cycle count", () => {
    const started = startTimer(createInitialTimerState(config), config, 0);
    const reset = resetTimer({ ...started, completedFocusCount: 3 }, config);
    expect(reset.status).toBe("idle");
    expect(reset.completedFocusCount).toBe(0);
  });
});
