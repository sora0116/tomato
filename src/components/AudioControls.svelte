<script lang="ts">
  let {
    enabled,
    volume,
    onToggle,
    onVolumeChange,
  }: {
    enabled: boolean;
    volume: number;
    onToggle: (enabled: boolean) => void;
    onVolumeChange: (volume: number) => void;
  } = $props();
</script>

<section class="audio-panel">
  <label class="checkbox">
    <input
      type="checkbox"
      checked={enabled}
      onchange={(event) => onToggle((event.currentTarget as HTMLInputElement).checked)}
    />
    <span>Brown noise during focus</span>
  </label>

  <label class="field">
    <span class="field__label">Volume</span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={volume}
      oninput={(event) => onVolumeChange(Number((event.currentTarget as HTMLInputElement).value))}
    />
    <span class="field__value">{volume.toFixed(2)}</span>
  </label>
</section>
