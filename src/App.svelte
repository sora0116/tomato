<script lang="ts">
  import { onMount } from "svelte";
  import TimerDisplay from "./components/TimerDisplay.svelte";
  import TimerControls from "./components/TimerControls.svelte";
  import PresetSelector from "./components/PresetSelector.svelte";
  import AudioControls from "./components/AudioControls.svelte";
  import SettingsDialog from "./components/SettingsDialog.svelte";
  import { createPomodoroController, type PomodoroViewState } from "./lib/timerStore";

  const controller = createPomodoroController();

  let state: PomodoroViewState = controller.getSnapshot();
  let dialogOpen = false;

  onMount(() => {
    return controller.subscribe((next) => {
      state = next;
    });
  });

  const openSettings = () => {
    dialogOpen = true;
  };
</script>

<svelte:head>
  <title>Pomodoro Timer</title>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />
</svelte:head>

<main class="shell">
  <section class="panel">
    <div class="panel__header">
      <div>
        <p class="eyebrow">Pomodoro Timer</p>
        <h1>Focused sessions without extra overhead.</h1>
      </div>
      <button
        class="ghost-button"
        type="button"
        onclick={openSettings}
      >
        Presets
      </button>
    </div>

    {#if state.notice}
      <div class="notice">{state.notice}</div>
    {/if}

    <TimerDisplay
      modeLabel={state.modeLabel}
      remainingLabel={state.remainingLabel}
      presetLabel={state.config.activePreset}
      completedFocusCount={state.timer.completedFocusCount}
    />

    <TimerControls
      status={state.timer.status}
      onStart={() => controller.start()}
      onPause={() => controller.pause()}
      onResume={() => controller.resume()}
      onSkip={() => controller.skip()}
      onReset={() => controller.reset()}
    />

    <PresetSelector
      presets={Object.keys(state.config.presets)}
      activePreset={state.config.activePreset}
      disabled={state.timer.status !== "idle"}
      onSelect={(presetName) => controller.selectPreset(presetName)}
    />

    <AudioControls
      enabled={state.config.audio.brownNoiseEnabled}
      volume={state.config.audio.volume}
      onToggle={(enabled) => controller.setBrownNoiseEnabled(enabled)}
      onVolumeChange={(volume) => controller.setVolume(volume)}
    />

    <p class="hint">
      Running or paused sessions keep their original durations. Preset changes apply from the next
      session or after reset.
    </p>
  </section>
</main>

<SettingsDialog
  open={dialogOpen}
  config={state.config}
  onClose={() => {
    dialogOpen = false;
  }}
  onAddPreset={() => controller.addPreset()}
  onDeletePreset={(presetName) => controller.deletePreset(presetName)}
  onRenamePreset={(oldName, newName) => controller.renamePreset(oldName, newName)}
  onUpdatePreset={(presetName, field, value) => controller.updatePreset(presetName, field, value)}
  onSelectPreset={(presetName) => controller.selectPreset(presetName)}
  onAudioFadeChange={(fadeInMs) => controller.setFadeInMs(fadeInMs)}
  onNotificationsToggle={(enabled) => controller.setDesktopNotifications(enabled)}
  onNotificationSoundToggle={(enabled) => controller.setNotificationSound(enabled)}
/>
