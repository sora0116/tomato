import { invoke } from "@tauri-apps/api/core";

export async function notifyTransition(
  title: string,
  body: string,
  enabled: boolean,
  soundEnabled: boolean,
): Promise<void> {
  try {
    await invoke("notify_transition", {
      payload: {
        title,
        body,
        enabled,
        soundEnabled,
      },
    });
  } catch (error) {
    console.error("notification failed", error);
  }
}
