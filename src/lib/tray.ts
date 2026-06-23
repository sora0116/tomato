import { invoke } from "@tauri-apps/api/core";
import type { TimerMode, TimerStatus } from "./config";

type TrayPayload = {
  status: TimerStatus;
  mode: TimerMode;
  remainingLabel: string;
  windowVisible: boolean;
};

export async function updateTray(payload: TrayPayload): Promise<void> {
  await invoke("update_tray_state", { payload });
}

export async function showMainWindow(): Promise<void> {
  await invoke("show_main_window");
}

export async function hideMainWindow(): Promise<void> {
  await invoke("hide_main_window");
}
