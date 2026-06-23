<script lang="ts">
  import type { AppConfig, PresetField } from "../lib/config";

  let {
    open,
    config,
    onClose,
    onAddPreset,
    onDeletePreset,
    onRenamePreset,
    onUpdatePreset,
    onSelectPreset,
    onAudioFadeChange,
    onNotificationsToggle,
    onNotificationSoundToggle,
  }: {
    open: boolean;
    config: AppConfig;
    onClose: () => void;
    onAddPreset: () => void;
    onDeletePreset: (presetName: string) => void;
    onRenamePreset: (oldName: string, newName: string) => void;
    onUpdatePreset: (presetName: string, field: PresetField, value: number) => void;
    onSelectPreset: (presetName: string) => void;
    onAudioFadeChange: (fadeInMs: number) => void;
    onNotificationsToggle: (enabled: boolean) => void;
    onNotificationSoundToggle: (enabled: boolean) => void;
  } = $props();
</script>

{#if open}
  <div
    class="dialog-backdrop"
    role="presentation"
    onclick={onClose}
  >
    <dialog
      class="dialog"
      aria-label="Preset settings"
      open
      onclick={(event) => event.stopPropagation()}
    >
      <div class="dialog__header">
        <h2>Settings</h2>
        <button
          class="ghost-button"
          type="button"
          onclick={onClose}
        >
          Close
        </button>
      </div>

      <div class="dialog__section">
        <div class="dialog__section-header">
          <h3>Presets</h3>
          <button
            class="secondary-button"
            type="button"
            onclick={onAddPreset}
          >
            Add preset
          </button>
        </div>

        {#each Object.entries(config.presets) as [presetName, preset]}
          <article class="preset-editor">
            <div class="preset-editor__header">
              <input
                class="preset-editor__name"
                type="text"
                value={presetName}
                onblur={(event) =>
                  onRenamePreset(presetName, (event.currentTarget as HTMLInputElement).value)}
              />
              <div class="preset-editor__actions">
                <button
                  class="ghost-button"
                  type="button"
                  onclick={() => onSelectPreset(presetName)}
                >
                  {config.activePreset === presetName ? "Active" : "Set active"}
                </button>
                <button
                  class="ghost-button ghost-button--danger"
                  type="button"
                  disabled={Object.keys(config.presets).length <= 1}
                  onclick={() => onDeletePreset(presetName)}
                >
                  Delete
                </button>
              </div>
            </div>

            <div class="preset-editor__grid">
              <label class="field">
                <span class="field__label">Focus</span>
                <input
                  type="number"
                  min="1"
                  value={preset.focusMinutes}
                  oninput={(event) =>
                    onUpdatePreset(
                      presetName,
                      "focusMinutes",
                      Number((event.currentTarget as HTMLInputElement).value),
                    )}
                />
              </label>
              <label class="field">
                <span class="field__label">Short break</span>
                <input
                  type="number"
                  min="1"
                  value={preset.shortBreakMinutes}
                  oninput={(event) =>
                    onUpdatePreset(
                      presetName,
                      "shortBreakMinutes",
                      Number((event.currentTarget as HTMLInputElement).value),
                    )}
                />
              </label>
              <label class="field">
                <span class="field__label">Long break</span>
                <input
                  type="number"
                  min="1"
                  value={preset.longBreakMinutes}
                  oninput={(event) =>
                    onUpdatePreset(
                      presetName,
                      "longBreakMinutes",
                      Number((event.currentTarget as HTMLInputElement).value),
                    )}
                />
              </label>
              <label class="field">
                <span class="field__label">Interval</span>
                <input
                  type="number"
                  min="1"
                  value={preset.longBreakInterval}
                  oninput={(event) =>
                    onUpdatePreset(
                      presetName,
                      "longBreakInterval",
                      Number((event.currentTarget as HTMLInputElement).value),
                    )}
                />
              </label>
            </div>
          </article>
        {/each}
      </div>

      <div class="dialog__section">
        <h3>Audio</h3>
        <label class="field">
          <span class="field__label">Brown noise fade-in (ms)</span>
          <input
            type="number"
            min="0"
            value={config.audio.fadeInMs}
            oninput={(event) => onAudioFadeChange(Number((event.currentTarget as HTMLInputElement).value))}
          />
        </label>
      </div>

      <div class="dialog__section">
        <h3>Notifications</h3>
        <label class="checkbox">
          <input
            type="checkbox"
            checked={config.notification.desktopNotification}
            onchange={(event) =>
              onNotificationsToggle((event.currentTarget as HTMLInputElement).checked)}
          />
          <span>Desktop notifications</span>
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            checked={config.notification.soundEnabled}
            onchange={(event) =>
              onNotificationSoundToggle((event.currentTarget as HTMLInputElement).checked)}
          />
          <span>Best-effort notification sound</span>
        </label>
      </div>
    </dialog>
  </div>
{/if}
