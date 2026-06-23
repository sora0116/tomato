<script lang="ts">
  let {
    modeLabel,
    remainingLabel,
    presetLabel,
    completedFocusCount,
  }: {
    modeLabel: string;
    remainingLabel: string;
    presetLabel: string;
    completedFocusCount: number;
  } = $props();
</script>

<section class="timer-card">
  <p class="timer-card__mode">{modeLabel}</p>
  <p class="timer-card__time">{remainingLabel}</p>
  <div class="timer-card__meta">
    <span>Preset: {presetLabel}</span>
    <span>Focus cycles: {completedFocusCount}</span>
  </div>
</section>
