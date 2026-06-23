<script lang="ts">
  let {
    presets,
    activePreset,
    disabled,
    onSelect,
  }: {
    presets: string[];
    activePreset: string;
    disabled: boolean;
    onSelect: (presetName: string) => void;
  } = $props();
</script>

<label class="field">
  <span class="field__label">Selected preset</span>
  <select
    value={activePreset}
    disabled={disabled}
    onchange={(event) => onSelect((event.currentTarget as HTMLSelectElement).value)}
  >
    {#each presets as preset}
      <option value={preset}>{preset}</option>
    {/each}
  </select>
</label>
